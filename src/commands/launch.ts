import { bot, SESSION, connection } from "../bot";
import { getUserKeypair, saveTransaction } from "../services/solana";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import {
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey,
} from "@solana/web3.js";
import {
    createInitializeMintInstruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddress,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function registerLaunchCommands() {

    bot.on("photo", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const session = SESSION[userId];
        if (session?.launchStep !== "image") return;

        try {
            await ctx.replyWithMarkdown("⏳ *Uploading image to IPFS...*");

            const photos = ctx.message.photo;
            const photo = photos[photos.length - 1];
            const fileId = photo!.file_id;

            const file = await ctx.telegram.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

            const response = await fetch(fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);

            const { uploadImageToIPFS } = await import("../services/ipfs");
            const imageUrl = await uploadImageToIPFS(imageBuffer, `${session.tokenSymbol}-logo.jpg`);

            SESSION[userId] = { ...session, tokenImageUrl: imageUrl, launchStep: "confirm" };

            ctx.replyWithMarkdown(
                `✅ *Image uploaded to IPFS!*\n\n` +
                `🖼️ [View Image](${imageUrl})\n\n` +
                `*Review Your Token:*\n\n` +
                `📛 Name: *${session.tokenName}*\n` +
                `🔤 Symbol: *${session.tokenSymbol}*\n` +
                `💰 Supply: *${session.tokenSupply?.toLocaleString('en-US')}*\n` +
                `📝 Description: *${session.tokenDescription}*\n` +
                `🖼️ Image: Uploaded to IPFS ✅\n\n` +
                `*Ready to launch?*\n` +
                `_Cost: ~0.01 SOL in fees_`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🚀 Launch Token!', 'confirm_launch'),
                        Markup.button.callback('❌ Cancel', 'cancel_launch')
                    ]
                ])
            );
        } catch (error) {
            console.error("Photo upload error:", error);
            ctx.reply("❌ Error uploading image. Type /skip to use default image.");
        }
    });

    bot.command("skip", async (ctx) => {
        const userId = ctx.from.id;
        const session = SESSION[userId];

        if (session?.launchStep !== "image") return;

        SESSION[userId] = {
            ...session,
            tokenImageUrl: "https://raw.githubusercontent.com/Armaansaxena/Solana-Trading-Bot/main/token-logo.png",
            launchStep: "confirm"
        };

        ctx.replyWithMarkdown(
            `✅ *Using default image*\n\n` +
            `*Review Your Token:*\n\n` +
            `📛 Name: *${session.tokenName}*\n` +
            `🔤 Symbol: *${session.tokenSymbol}*\n` +
            `💰 Supply: *${session.tokenSupply?.toLocaleString('en-US')}*\n` +
            `📝 Description: *${session.tokenDescription}*\n\n` +
            `*Ready to launch?*\n` +
            `_Cost: ~0.01 SOL in fees_`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🚀 Launch Token!', 'confirm_launch'),
                    Markup.button.callback('❌ Cancel', 'cancel_launch')
                ]
            ])
        );
    });

    bot.action('launch_menu', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🚀 *Launch a Token*\n\n` +
            `Create and deploy your own SPL token on Solana\n\n` +
            `*What you'll need:*\n` +
            `• Token name (e.g. "My Token")\n` +
            `• Symbol (e.g. "MTK")\n` +
            `• Total supply (e.g. 1000000)\n` +
            `• Description\n` +
            `• Token image (or use default)\n\n` +
            `*Cost:* ~0.01 SOL (rent fees)\n\n` +
            `_Your wallet needs SOL to cover fees_`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🚀 Start Launch', 'start_launch')],
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    });

    bot.action('start_launch', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery();

        const keypair = await getUserKeypair(userId);
        if (!keypair) {
            return ctx.reply("❌ No wallet found. Generate one first.", mainKeyboard());
        }

        SESSION[userId] = { launchStep: "name" };
        return ctx.replyWithMarkdown(
            `🚀 *Token Launch Wizard*\n\n` +
            `*Step 1/5* — Token Name\n\n` +
            `What is your token called?\n\n` +
            `Example: \`Solana Moon Token\`\n\n` +
            `_Type /cancel to abort_`
        );
    });

    bot.command('launch', async (ctx) => {
        const userId = ctx.from.id;
        const keypair = await getUserKeypair(userId);
        if (!keypair) {
            return ctx.reply("❌ No wallet found. Generate one first.", mainKeyboard());
        }
        SESSION[userId] = { launchStep: "name" };
        return ctx.replyWithMarkdown(
            `🚀 *Token Launch Wizard*\n\n` +
            `*Step 1/5* — Token Name\n\n` +
            `What is your token called?\n\n` +
            `Example: \`Solana Moon Token\`\n\n` +
            `_Type /cancel to abort_`
        );
    });

    bot.action('confirm_launch', async (ctx) => {
        const userId = ctx.from!.id;
        const session = SESSION[userId];

        if (!session?.tokenName || !session?.tokenSymbol || !session?.tokenSupply) {
            await ctx.answerCbQuery("❌ Session expired");
            return ctx.reply("❌ Session expired. Please run /launch again.");
        }

        await ctx.answerCbQuery("Launching token...");
        await ctx.replyWithMarkdown(
            `⏳ *Launching Token...*\n\n` +
            `Creating ${session.tokenName} (${session.tokenSymbol})\n\n` +
            `_This may take 10-30 seconds_`
        );

        try {
            const keypair = await getUserKeypair(userId);
            if (!keypair) return ctx.reply("❌ No wallet found.");

            const mintKeypair = Keypair.generate();
            const rentLamports = await getMinimumBalanceForRentExemptMint(connection);
            const associatedTokenAccount = await getAssociatedTokenAddress(
                mintKeypair.publicKey,
                keypair.publicKey
            );

            // Upload metadata to IPFS first
            const { uploadMetadataToIPFS } = await import("../services/ipfs");
            const metadataUrl = await uploadMetadataToIPFS({
                name: session.tokenName!,
                symbol: session.tokenSymbol!,
                description: session.tokenDescription || "",
                image: session.tokenImageUrl || "https://raw.githubusercontent.com/Armaansaxena/Solana-Trading-Bot/main/token-logo.png",
            });
            console.log("✅ Metadata uploaded to IPFS:", metadataUrl);

            // Create mint transaction
            const transaction = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: keypair.publicKey,
                    newAccountPubkey: mintKeypair.publicKey,
                    space: MINT_SIZE,
                    lamports: rentLamports,
                    programId: TOKEN_PROGRAM_ID,
                }),
                createInitializeMintInstruction(
                    mintKeypair.publicKey,
                    9,
                    keypair.publicKey,
                    keypair.publicKey,
                    TOKEN_PROGRAM_ID
                ),
                createAssociatedTokenAccountInstruction(
                    keypair.publicKey,
                    associatedTokenAccount,
                    keypair.publicKey,
                    mintKeypair.publicKey
                ),
                createMintToInstruction(
                    mintKeypair.publicKey,
                    associatedTokenAccount,
                    keypair.publicKey,
                    session.tokenSupply! * Math.pow(10, 9)
                ),
            );

            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [keypair, mintKeypair]
            );

            console.log("⏳ Waiting for mint to be confirmed...");
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Add Metaplex metadata
            try {
                const [metadataPDA] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("metadata"),
                        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                        mintKeypair.publicKey.toBuffer(),
                    ],
                    TOKEN_METADATA_PROGRAM_ID
                );

                const metadataTransaction = new Transaction().add(
                    createCreateMetadataAccountV3Instruction(
                        {
                            metadata: metadataPDA,
                            mint: mintKeypair.publicKey,
                            mintAuthority: keypair.publicKey,
                            payer: keypair.publicKey,
                            updateAuthority: keypair.publicKey,
                        },
                        {
                            createMetadataAccountArgsV3: {
                                data: {
                                    name: session.tokenName!,
                                    symbol: session.tokenSymbol!,
                                    uri: metadataUrl,
                                    sellerFeeBasisPoints: 0,
                                    creators: null,
                                    collection: null,
                                    uses: null,
                                },
                                isMutable: true,
                                collectionDetails: null,
                            },
                        }
                    )
                );

                await sendAndConfirmTransaction(connection, metadataTransaction, [keypair]);
                console.log("✅ Metaplex metadata added");
            } catch (metaError) {
                console.error("Metadata error (non-critical):", metaError);
            }

            await saveTransaction(
                userId, 'launch', 0,
                signature, 'success',
                session.tokenName!, session.tokenSymbol!
            );

            SESSION[userId] = {};

            const mintAddress = mintKeypair.publicKey.toBase58();

            return ctx.replyWithMarkdown(
                `🎉 *Token Launched Successfully!*\n\n` +
                `📛 *Name:* ${session.tokenName}\n` +
                `🔤 *Symbol:* ${session.tokenSymbol}\n` +
                `💰 *Supply:* ${session.tokenSupply!.toLocaleString('en-US')}\n` +
                `📝 *Description:* ${session.tokenDescription || "N/A"}\n\n` +
                `🔑 *Token CA:*\n\`${mintAddress}\`\n\n` +
                `🔗 [View on Solscan](https://solscan.io/token/${mintAddress}?cluster=devnet)\n` +
                `🔗 [View Transaction](https://solscan.io/tx/${signature}?cluster=devnet)\n\n` +
                `✅ _Token deployed on Solana Devnet_`,
                Markup.inlineKeyboard([
                    [Markup.button.url("🌐 View Token", `https://solscan.io/token/${mintAddress}?cluster=devnet`)],
                    [Markup.button.callback("📊 Portfolio", "portfolio"), Markup.button.callback("🏠 Menu", "main_menu")]
                ])
            );
        } catch (error: any) {
            SESSION[userId] = {};
            console.error("Token launch error:", error);
            return ctx.replyWithMarkdown(
                `❌ *Token Launch Failed*\n\n${error.message || "Unknown error"}`,
                mainKeyboard()
            );
        }
    });

    bot.action('cancel_launch', async (ctx) => {
        const userId = ctx.from!.id;
        SESSION[userId] = {};
        await ctx.answerCbQuery("Cancelled");
        return ctx.replyWithMarkdown("❌ *Token launch cancelled.*", mainKeyboard());
    });
}

export function handleLaunchText(userId: number, text: string, session: any, ctx: any): boolean {
    if (!session?.launchStep) return false;

    if (session.launchStep === "name") {
        if (text.length < 2 || text.length > 32) {
            ctx.reply("❌ Name must be 2-32 characters. Try again:");
            return true;
        }
        SESSION[userId] = { ...session, tokenName: text, launchStep: "symbol" };
        ctx.replyWithMarkdown(
            `✅ Name: *${text}*\n\n` +
            `*Step 2/5* — Token Symbol\n\n` +
            `Enter a short symbol (2-10 chars)\n\n` +
            `Example: \`MTK\`, \`MOON\`, \`DOGE\`\n\n` +
            `_Type /cancel to abort_`
        );
        return true;
    }

    if (session.launchStep === "symbol") {
        const symbol = text.toUpperCase().trim();
        if (symbol.length < 2 || symbol.length > 10) {
            ctx.reply("❌ Symbol must be 2-10 characters. Try again:");
            return true;
        }
        SESSION[userId] = { ...session, tokenSymbol: symbol, launchStep: "supply" };
        ctx.replyWithMarkdown(
            `✅ Symbol: *${symbol}*\n\n` +
            `*Step 3/5* — Total Supply\n\n` +
            `How many tokens to mint?\n\n` +
            `Example: \`1000000\` for 1 million\n\n` +
            `_Type /cancel to abort_`
        );
        return true;
    }

    if (session.launchStep === "supply") {
        const supply = parseInt(text.replace(/,/g, ""));
        if (isNaN(supply) || supply <= 0 || supply > 1_000_000_000_000) {
            ctx.reply("❌ Invalid supply. Enter a number between 1 and 1 trillion:");
            return true;
        }
        SESSION[userId] = { ...session, tokenSupply: supply, launchStep: "description" };
        ctx.replyWithMarkdown(
            `✅ Supply: *${supply.toLocaleString('en-US')}*\n\n` +
            `*Step 4/5* — Description\n\n` +
            `Describe your token in a few words\n\n` +
            `Example: \`The best meme token on Solana\`\n\n` +
            `_Type /cancel to abort_`
        );
        return true;
    }

    if (session.launchStep === "description") {
        SESSION[userId] = { ...session, tokenDescription: text, launchStep: "image" };
        ctx.replyWithMarkdown(
            `✅ Description: *${text}*\n\n` +
            `*Step 5/5* — Token Image\n\n` +
            `Send a photo for your token logo\n\n` +
            `• Square image works best\n` +
            `• PNG or JPG\n\n` +
            `_Type /skip to use default image_`
        );
        return true;
    }

    return false;
}