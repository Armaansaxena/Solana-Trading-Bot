import { bot, SESSION, connection } from "../bot";
import { getUserKeypair, prisma, saveTransaction } from "../services/solana";
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

export function registerLaunchCommands() {

    bot.action('launch_menu', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🚀 *Launch a Token*\n\n` +
            `Create and deploy your own SPL token on Solana\n\n` +
            `*What you'll need:*\n` +
            `• Token name (e.g. "My Token")\n` +
            `• Symbol (e.g. "MTK")\n` +
            `• Total supply (e.g. 1000000)\n` +
            `• Description\n\n` +
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
            `*Step 1/4* — Token Name\n\n` +
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
            `*Step 1/4* — Token Name\n\n` +
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

            // Save to transaction history
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
            `*Step 2/4* — Token Symbol\n\n` +
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
            `*Step 3/4* — Total Supply\n\n` +
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
            `*Step 4/4* — Description\n\n` +
            `Describe your token in a few words\n\n` +
            `Example: \`The best meme token on Solana\`\n\n` +
            `_Type /cancel to abort_`
        );
        return true;
    }

    if (session.launchStep === "description") {
        SESSION[userId] = { ...session, tokenDescription: text, launchStep: "confirm" };
        ctx.replyWithMarkdown(
            `✅ *Review Your Token*\n\n` +
            `📛 Name: *${session.tokenName}*\n` +
            `🔤 Symbol: *${session.tokenSymbol}*\n` +
            `💰 Supply: *${session.tokenSupply?.toLocaleString('en-US')}*\n` +
            `📝 Description: *${text}*\n\n` +
            `*Ready to launch?*\n` +
            `_Cost: ~0.01 SOL in fees_`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🚀 Launch Token!', 'confirm_launch'),
                    Markup.button.callback('❌ Cancel', 'cancel_launch')
                ]
            ])
        );
        return true;
    }

    return false;
}