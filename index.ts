import { Telegraf, Markup } from "telegraf";
import { 
    Keypair, 
    Connection, 
    clusterApiUrl, 
    LAMPORTS_PER_SOL, 
    PublicKey, 
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction 
} from "@solana/web3.js";
import bs58 from "bs58";
import * as dotenv from "dotenv";
// import { User } from "./models/User";
// import { connectDB } from "./db";
import { saveUserWallet } from "./db";
import { encrypt, decrypt } from "./utils/crypto";
import { redis } from "./db";
import { getUserWallet } from "./db";

dotenv.config();

// Types
interface SessionData {
    waitingForAddress?: boolean;
    waitingForAmount?: boolean;
    receiverAddress?: string;
    sendAmount?: number;
}

// Initialize bot with environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is not defined in environment variables");
}

const bot = new Telegraf(BOT_TOKEN);
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Session storage (for conversation state only)
const SESSION: Record<number, SessionData> = {};

// --- Helper Functions ---

async function getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
}

async function getUserKeypair(telegramId: number): Promise<Keypair | null> {
    const user: any = await getUserWallet(telegramId); // Use 'any' here to simplify access
    if (!user || !user.iv || !user.encryptedKey) return null;

    // Cast the unknown properties to strings using 'as string'
    const decryptedKey = decrypt(user.iv as string, user.encryptedKey as string);
    const secretKeyArray = bs58.decode(decryptedKey);
    
    return Keypair.fromSecretKey(secretKeyArray);
}

// --- Keyboards ---

const mainKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('✨ Generate Wallet', 'generate_wallet')],
    [
        Markup.button.callback('🔍 Public Key', 'show_public_key'),
        Markup.button.callback('💰 Balance', 'check_balance')
    ],
    [
        Markup.button.callback('💸 Send SOL', 'send_sol'),
        Markup.button.callback('🔑 Export Key', 'show_private_key')
    ]
]);

const postWalletKeyboard = () => Markup.inlineKeyboard([
    [
        Markup.button.callback('💸 Send SOL', 'send_sol'),
        Markup.button.callback('💰 Balance', 'check_balance')
    ],
    [
        Markup.button.callback('🔍 Public Key', 'show_public_key'),
        Markup.button.callback('🔑 Export Key', 'show_private_key')
    ],
    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
]);

const dangerKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('⚠️ YES, Show Private Key', 'confirm_show_private')],
    [Markup.button.callback('❌ Cancel', 'main_menu')]
]);

// --- Command Handlers ---

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    SESSION[userId] = {};
    
    const welcomeMessage = 
        "🚀 *Welcome to Solana Trading Bot*\n\n" +
        "Your secure gateway to Solana blockchain\n\n" +
        "🔹 *Create Wallets* - Instant generation\n" +
        "🔹 *Send SOL* - Fast & secure transfers\n" +
        "🔹 *Check Balances* - Real-time tracking\n" +
        "🔹 *Export Keys* - Secure backup system\n\n" +
        "⚠️ *Network:* Solana DEVNET (test mode)\n" +
        "🚰 *Get Free SOL:* [Solana Faucet](https://faucet.solana.com)\n\n" +
        "💡 _Tip: Use /help for commands_";
    
    return ctx.replyWithMarkdown(welcomeMessage, mainKeyboard());
});

bot.command('help', async (ctx) => {
    const helpText = 
        "📖 *Bot Commands & Features*\n\n" +
        "🔹 Generate a new wallet\n" +
        "🔹 View your public key\n" +
        "🔹 Check wallet balance\n" +
        "🔹 Send SOL to any address\n" +
        "🔹 Export private keys securely\n\n" +
        "⚠️ *Security Notes:*\n" +
        "• Never share your private key\n" +
        "• This is DEVNET (test mode)\n" +
        "• Get free SOL from faucet.solana.com";
    
    return ctx.replyWithMarkdown(helpText, mainKeyboard());
});

bot.command('about', async (ctx) => {
    const aboutText = 
        "ℹ️ *About Solana Trading Bot*\n\n" +
        "🤖 *Version:* 1.0.0\n" +
        "⚡ *Network:* Solana Devnet\n" +
        "🔐 *Security:* Military-grade encryption\n\n" +
        "🌟 *Features:*\n" +
        "✅ Instant wallet generation\n" +
        "✅ Secure key management\n" +
        "✅ Fast SOL transfers\n" +
        "✅ Real-time balance tracking\n" +
        "✅ Export & backup functionality\n\n" +
        "🛡️ *Your Security:*\n" +
        "• Keys encrypted in database\n" +
        "• AES-256 encryption\n" +
        "• Auto-delete sensitive data\n\n" +
        "📞 *Support:* @YourSupportUsername\n" +
        "🌐 *Website:* yourwebsite.com";
    
    return ctx.replyWithMarkdown(aboutText, mainKeyboard());
});

// --- Action Handlers ---

bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText(
        "🏠 *Main Menu*\nChoose an action:",
        { parse_mode: "Markdown", ...mainKeyboard() }
    );
});

bot.action('generate_wallet', async (ctx) => {
    await ctx.answerCbQuery('Generating wallet...');
    const userId = ctx.from!.id;

    // 1. Generate Keypair
    const keypair = Keypair.generate();
    const secretKeyStr = bs58.encode(keypair.secretKey);

    // 2. Encrypt Private Key
    const { iv, content } = encrypt(secretKeyStr);

    try {
        // 3. Save to Redis as a Hash
        await saveUserWallet(userId, {
            publicKey: keypair.publicKey.toBase58(),
            encryptedKey: content,
            iv: iv
        });

        return ctx.replyWithMarkdown(
            `✅ *Wallet Generated & Saved to Redis!*\n\n` +
            `📍 *Public Key:* \`${keypair.publicKey.toBase58()}\`\n\n` +
            `💰 *Balance:* 0 SOL`
        );
    } catch (error) {
        console.error("Redis Error:", error);
        return ctx.reply("❌ Database connection failed.");
    }
});

bot.action('show_public_key', async (ctx) => {
    const userId = ctx.from!.id;

    try {
        const user = await getUserWallet(userId);
        
        if (!user) {
            await ctx.answerCbQuery("❌ No wallet found");
            return ctx.reply("❌ No wallet found. Generate one first.", mainKeyboard());
        }

        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `📍 *Your Public Key:*\n\`${user.publicKey}\`\n\n` +
            `_Share this address to receive SOL_`,
            postWalletKeyboard()
        );
    } catch (error) {
        console.error("Error fetching public key:", error);
        return ctx.reply("❌ Error retrieving public key.");
    }
});

bot.action('check_balance', async (ctx) => {
    const userId = ctx.from!.id;
    
    // 1. Get data from Redis (NOT MongoDB)
    const userData = await getUserWallet(userId);

    if (!userData || !userData.publicKey) {
        await ctx.answerCbQuery("❌ No wallet found");
        return ctx.reply("❌ Please generate a wallet first.", mainKeyboard());
    }

    await ctx.answerCbQuery("Checking balance...");
    
    try {
        const pubKey = new PublicKey(userData.publicKey as string);
        const balance = await getBalance(pubKey);
        
        return ctx.replyWithMarkdown(
            `💰 *Wallet Balance*\n\n` +
            `${balance.toFixed(4)} SOL\n\n` +
            `📍 Address:\n\`${userData.publicKey}\``,
            postWalletKeyboard()
        );
    } catch (error) {
        console.error("Balance check error:", error);
        return ctx.reply("❌ Error connecting to Solana. Try again.");
    }
});

bot.action('show_private_key', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
        "⚠️ *WARNING: EXTREME DANGER*\n\n" +
        "Showing your private key is *extremely dangerous*!\n\n" +
        "Anyone with this key can *steal all your funds*.\n\n" +
        "Are you sure you want to continue?",
        dangerKeyboard()
    );
});

bot.action('confirm_show_private', async (ctx) => {
    const userId = ctx.from!.id;

    try {
        const keypair = await getUserKeypair(userId);
        
        if (!keypair) {
            await ctx.answerCbQuery("❌ No wallet found");
            return ctx.reply("❌ Generate a wallet first.", mainKeyboard());
        }

        await ctx.answerCbQuery();
        const secretKey = bs58.encode(keypair.secretKey);
        
        // Create export file
        const exportData = 
            `SOLANA WALLET EXPORT\n` +
            `====================\n\n` +
            `⚠️  KEEP THIS INFORMATION SECURE  ⚠️\n\n` +
            `Public Key (Share this to receive SOL):\n${keypair.publicKey.toBase58()}\n\n` +
            `Private Key (NEVER share this):\n${secretKey}\n\n` +
            `Network: Solana Devnet\n` +
            `Exported: ${new Date().toLocaleString()}\n\n` +
            `---\n` +
            `SECURITY WARNINGS:\n` +
            `• Anyone with your private key can steal your funds\n` +
            `• Never share your private key with anyone\n` +
            `• Store this file in a secure, encrypted location\n` +
            `• Delete this message immediately after saving\n`;
        
        // Send file
        await ctx.replyWithDocument(
            {
                source: Buffer.from(exportData),
                filename: `solana-wallet-${Date.now()}.txt`
            },
            {
                caption: 
                    `🔐 *Wallet Export Complete*\n\n` +
                    `⚠️ *CRITICAL SECURITY WARNINGS:*\n` +
                    `• File contains your PRIVATE KEY\n` +
                    `• Store in encrypted, offline location\n` +
                    `• Never share with anyone\n` +
                    `• Delete from Telegram after saving\n\n` +
                    `_This message will self-destruct in 2 minutes_`,
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("🗑️ Delete Now", "delete_msg")],
                    [Markup.button.callback("🏠 Main Menu", "main_menu")]
                ])
            }
        );

        // Quick copy message
        const msg = await ctx.replyWithMarkdown(
            `📋 *Quick Copy Format:*\n\n` +
            `*Private Key (Base58):*\n\`${secretKey}\`\n\n` +
            `*Public Key:*\n\`${keypair.publicKey.toBase58()}\`\n\n` +
            `⏰ *Delete this message immediately after copying*`,
            Markup.inlineKeyboard([
                [Markup.button.callback("🗑️ Delete", "delete_msg")]
            ])
        );

        // Auto-delete after 2 minutes
        setTimeout(() => {
            try {
                ctx.deleteMessage(msg.message_id);
            } catch (e) {
                // Already deleted
            }
        }, 120000);
    } catch (error) {
        console.error("Export error:", error);
        return ctx.reply("❌ Error exporting keys. Please try again.");
    }
});

bot.action('send_sol', async (ctx) => {
    const userId = ctx.from!.id;

    try {
        const keypair = await getUserKeypair(userId);
        
        if (!keypair) {
            await ctx.answerCbQuery("❌ No wallet found");
            return ctx.reply("❌ Generate a wallet first.", mainKeyboard());
        }

        const balance = await getBalance(keypair.publicKey);
        
        if (balance < 0.01) {
            await ctx.answerCbQuery();
            return ctx.replyWithMarkdown(
                `❌ *Insufficient Balance*\n\n` +
                `Current: ${balance.toFixed(4)} SOL\n\n` +
                `Get free devnet SOL:\n[Solana Faucet](https://faucet.solana.com)`
            );
        }

        SESSION[userId] = { waitingForAmount: true };
        await ctx.answerCbQuery();
        
        return ctx.replyWithMarkdown(
            `💸 *Send SOL*\n\n` +
            `💰 Available Balance: ${balance.toFixed(4)} SOL\n\n` +
            `📊 *How much SOL do you want to send?*\n\n` +
            `Examples:\n` +
            `• Type \`0.5\` for half SOL\n` +
            `• Type \`1\` for 1 SOL\n` +
            `• Type \`all\` to send maximum\n\n` +
            `_Type /cancel to abort_`
        );
    } catch (error) {
        console.error("Send SOL error:", error);
        return ctx.reply("❌ Error initiating transfer. Please try again.");
    }
});

// Handle text messages
bot.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (ctx.message.text === '/cancel') {
        SESSION[userId] = {};
        return ctx.reply("❌ Operation cancelled.", mainKeyboard());
    }

    const userSession = SESSION[userId];

    try {
        const userKeypair = await getUserKeypair(userId);
        
        if (!userKeypair) {
            return ctx.reply("❌ No wallet found. Use /start to create one.");
        }

        // Step 1: Amount input
        if (userSession?.waitingForAmount) {
            const input = ctx.message.text.trim().toLowerCase();
            const balance = await getBalance(userKeypair.publicKey);
            let amount: number;

            if (input === 'all' || input === 'max') {
                amount = Math.max(0, balance - 0.001);
                if (amount <= 0) {
                    return ctx.reply("❌ Insufficient balance to cover transaction fees.");
                }
            } else {
                amount = parseFloat(input);
                
                if (isNaN(amount) || amount <= 0) {
                    return ctx.reply(
                        "❌ Invalid amount. Please enter a valid number.\n" +
                        "Examples: 0.5, 1, 2.5 or type 'all'"
                    );
                }

                if (amount > balance) {
                    return ctx.replyWithMarkdown(
                        `❌ *Insufficient Balance*\n\n` +
                        `Requested: ${amount.toFixed(4)} SOL\n` +
                        `Available: ${balance.toFixed(4)} SOL`
                    );
                }

                if (amount + 0.000005 > balance) {
                    return ctx.reply(
                        "❌ Insufficient balance to cover amount + fees.\n" +
                        `Try sending ${(balance - 0.001).toFixed(4)} SOL or less.`
                    );
                }
            }

            SESSION[userId] = { 
                waitingForAddress: true, 
                sendAmount: amount 
            };

            return ctx.replyWithMarkdown(
                `✅ *Amount Confirmed*\n\n` +
                `Sending: ${amount.toFixed(4)} SOL\n\n` +
                `📨 Now send the *recipient's Solana address*:\n\n` +
                `_Type /cancel to abort_`
            );
        }

        // Step 2: Address input
        if (userSession?.waitingForAddress) {
            const address = ctx.message.text.trim();
            const sendAmount = userSession.sendAmount || 1;

            const toPublicKey = new PublicKey(address);
            
            if (toPublicKey.equals(userKeypair.publicKey)) {
                return ctx.reply("❌ Cannot send to your own address!");
            }

            await ctx.replyWithMarkdown(
                `⏳ *Processing Transaction*\n\n` +
                `Amount: ${sendAmount.toFixed(4)} SOL\n` +
                `To: \`${address.slice(0, 8)}...${address.slice(-8)}\`\n\n` +
                `Please wait...`
            );

            const lamportsToSend = Math.floor(sendAmount * LAMPORTS_PER_SOL);
            
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: userKeypair.publicKey,
                    toPubkey: toPublicKey,
                    lamports: lamportsToSend,
                })
            );

            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [userKeypair]
            );

            const newBalance = await getBalance(userKeypair.publicKey);

            await ctx.replyWithMarkdown(
                `✅ *Transaction Successful!*\n\n` +
                `💰 Sent: ${sendAmount.toFixed(4)} SOL\n` +
                `📊 New Balance: ${newBalance.toFixed(4)} SOL\n` +
                `📍 To: \`${address}\`\n\n` +
                `🔗 [View on Solscan](https://solscan.io/tx/${signature}?cluster=devnet)`,
                Markup.inlineKeyboard([
                    [Markup.button.url("🌐 Explorer", `https://explorer.solana.com/tx/${signature}?cluster=devnet`)],
                    [Markup.button.callback("💸 Send More", "send_sol"), Markup.button.callback("🏠 Menu", "main_menu")]
                ])
            );

            SESSION[userId] = {};
        }
    } catch (error: any) {
        console.error("Text handler error:", error);
        
        let errorMsg = "❌ *Transaction Failed*\n\n";
        
        if (error.message?.includes("invalid")) {
            errorMsg += "Invalid Solana address format.";
        } else if (error.message?.includes("insufficient")) {
            errorMsg += "Insufficient funds for transaction + fees.";
        } else {
            errorMsg += "Error: " + (error.message || "Unknown error");
        }
        
        ctx.replyWithMarkdown(errorMsg, mainKeyboard());
        SESSION[userId] = {};
    }
});

bot.action('delete_msg', (ctx) => ctx.deleteMessage());

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again.');
});

// Initialize and launch bot
async function startBot() {
    try {
        // Test Redis connection
        const pong = await redis.ping();
        if (pong !== "PONG") {
            throw new Error("Could not connect to Redis");
        }
        
        console.log("✅ Redis connection verified!");

        await bot.launch();
        console.log("✅ Solana Trading Bot is running!");
        console.log(`📍 Network: Solana Devnet`);
    } catch (error) {
        console.error("❌ Failed to start bot:", error);
        process.exit(1);
    }
}

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));