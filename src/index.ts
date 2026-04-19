import * as dotenv from "dotenv";
dotenv.config();

import { bot } from "./bot";
import { prisma } from "./services/db";
import { Context, Markup } from "telegraf";
import { createServer } from "http";
import { registerWalletCommands } from "./commands/wallet";
import { registerSwapCommands } from "./commands/swap";
import { registerPortfolioCommands } from "./commands/portfolio";
import { registerLaunchCommands } from "./commands/launch";
import { registerAICommands } from "./commands/ai";
import { registerHistoryCommands } from "./commands/history";
import { registerAlertCommands, startAlertChecker } from "./commands/alerts";
import { registerWatchlistCommands } from "./commands/watchlist";
import { registerReferralCommands } from "./commands/referral";
import { mainKeyboard, walletKeyboard, toolsKeyboard, moreToolsKeyboard } from "./keyboards";

// Global debug middleware
bot.use((ctx, next) => {
    console.log("📨 Update:", ctx.updateType);
    return next();
});

// Core commands — registered FIRST
bot.start(async (ctx: Context) => {
    const userId = ctx.from!.id;
    console.log("✅ /start received from:", userId);

    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { wallets: true }
    });

    if (!user || user.wallets.length === 0) {
        return ctx.replyWithMarkdown(
            "👋 *Welcome to ArmEthSol (SolBot V3)!*\n\n" +
            "The fastest way to trade and manage assets on Solana, Ethereum, and Base.\n\n" +
            "🚀 *Getting Started:*\n" +
            "1️⃣ Generate your secure wallets\n" +
            "2️⃣ Deposit funds to your address\n" +
            "3️⃣ Start swapping across chains!\n\n" +
            "🔐 *Your keys, your crypto.* All private keys are AES-256 encrypted.",
            Markup.inlineKeyboard([
                [Markup.button.callback("🆕 Generate My Wallets", "generate_wallet")],
                [Markup.button.callback("📖 Learn More", "about")]
            ])
        );
    }

    const currentChain = user.activeChain || "solana";
    const chainType = (currentChain === 'ethereum' || currentChain === 'base') ? 'evm' : 'solana';
    const activeWallet = user.wallets.find(w => w.chain === chainType) || user.wallets[0];

    if (!activeWallet) return ctx.reply("❌ No wallet found. Please /start again.");

    return ctx.replyWithMarkdown(
        "🚀 *Welcome back to SolBot V3*\n\n" +
        `📍 *Active Wallet (${currentChain.toUpperCase()}):* \`${activeWallet.publicKey.slice(0, 4)}...${activeWallet.publicKey.slice(-4)}\`\n` +
        `🌐 *Active Chain:* ${currentChain.toUpperCase()}\n\n` +
        "What would you like to do today?",
        mainKeyboard(currentChain)
    );
});

bot.action('main_menu', async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { wallets: true }
    });
    
    await ctx.answerCbQuery();
    const currentChain = user?.activeChain || "solana";
    const chainType = (currentChain === 'ethereum' || currentChain === 'base') ? 'evm' : 'solana';
    const activeWallet = user?.wallets.find(w => w.chain === chainType);

    let message = "🚀 *Welcome to SolBot V3*\n\n" +
                  "Your all-in-one multi-chain trading assistant\n\n" +
                  `🌐 *Active Chain:* ${currentChain.toUpperCase()}`;
    
    if (activeWallet) {
        message += `\n📍 *Address:* \`${activeWallet.publicKey.slice(0, 6)}...${activeWallet.publicKey.slice(-4)}\``;
    }

    try {
        return await ctx.editMessageText(
            message,
            { parse_mode: "Markdown", ...mainKeyboard(currentChain) }
        );
    } catch (error: any) {
        if (error.description?.includes("message is not modified")) return;
        throw error;
    }
});

bot.action('switch_chain_menu', async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) }
    });

    await ctx.answerCbQuery();
    const currentChain = user?.activeChain || "solana";

    try {
        return await ctx.editMessageText(
            "🌐 *Switch Active Chain*\n\nSelect a chain to trade on:",
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`${currentChain === 'solana' ? '✅ ' : ''}Solana`, 'confirm_switch_chain_solana')],
                    [Markup.button.callback(`${currentChain === 'ethereum' ? '✅ ' : ''}Ethereum`, 'confirm_switch_chain_ethereum')],
                    [Markup.button.callback(`${currentChain === 'base' ? '✅ ' : ''}Base`, 'confirm_switch_chain_base')],
                    [Markup.button.callback('🔙 Back', 'main_menu')]
                ])
            }
        );
    } catch (error: any) {
        if (error.description?.includes("message is not modified")) return;
        throw error;
    }
});

import { createSolanaWallet } from "./services/solana";
import { createEVMWallet } from "./services/evm";

bot.action(/^confirm_switch_chain_(solana|ethereum|base)$/, async (ctx) => {
    const newChain = (ctx as any).match[1];
    const userId = ctx.from!.id;

    try {
        let user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            include: { wallets: true }
        });

        if (!user) return ctx.answerCbQuery("❌ User not found");

        const chainType = (newChain === 'ethereum' || newChain === 'base') ? 'evm' : 'solana';
        let correctWallet = user.wallets.find(w => w.chain === chainType);

        // AUTO-GENERATE MISSING WALLET TYPE
        if (!correctWallet) {
            console.log(`🛠️ Auto-generating missing ${chainType} wallet for user ${userId}`);
            if (chainType === 'evm') {
                correctWallet = await createEVMWallet(user.id);
            } else {
                correctWallet = await createSolanaWallet(user.id);
            }
        }

        await prisma.user.update({
            where: { telegramId: BigInt(userId) },
            data: { 
                activeChain: newChain,
                activeWalletId: correctWallet.id
            }
        });

        await ctx.answerCbQuery(`✅ Switched to ${newChain.toUpperCase()}`);
        
        // Refresh view
        const userAfter = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            include: { wallets: true }
        });

        const activeWallet = userAfter?.wallets.find(w => w.id === userAfter.activeWalletId);

        let message = "🚀 *Welcome to SolBot V3*\n\n" +
                      "Your all-in-one multi-chain trading assistant\n\n" +
                      `🌐 *Active Chain:* ${newChain.toUpperCase()}`;
        
        if (activeWallet) {
            message += `\n📍 *Address:* \`${activeWallet.publicKey.slice(0, 6)}...${activeWallet.publicKey.slice(-4)}\``;
        }

        return ctx.editMessageText(
            message,
            { parse_mode: "Markdown", ...mainKeyboard(newChain) }
        );
    } catch (error) {
        console.error("Switch chain error:", error);
        return ctx.answerCbQuery("❌ Failed to switch chain");
    }
});

bot.action('tools_menu', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText("🛠️ *Tools & Features*\nAccess specialized bot features:", {
        parse_mode: "Markdown",
        ...toolsKeyboard()
    });
});

bot.action('more_tools_menu', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText("📜 *More Tools*\nAdditional features and settings:", {
        parse_mode: "Markdown",
        ...moreToolsKeyboard()
    });
});

bot.command('help', async (ctx: Context) => {
    return ctx.replyWithMarkdown(
        "📖 *SolBot V3 Commands*\n\n" +
        "/start — Main menu\n" +
        "/swap SOL USDC 1 — Swap tokens\n" +
        "/price SOL — Get token price\n" +
        "/portfolio — View all balances\n" +
        "/help — This message\n\n" +
        "*Supported tokens:*\n" +
        "SOL • USDC • USDT • BONK • JUP • WIF"
    );
});

bot.action('about', async (ctx: Context) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
        "ℹ️ *About SolBot V3*\n\n" +
        "🤖 *Version:* 3.0.0\n" +
        "⚡ *Network:* Solana Mainnet\n" +
        "🔐 *Security:* AES-256 encryption\n" +
        "🗄️ *Database:* Supabase (PostgreSQL)\n" +
        "🚀 *Sessions:* Upstash Redis\n\n" +
        "🌟 *Features:*\n" +
        "✅ Multi-wallet support\n" +
        "✅ Token swaps via Jupiter\n" +
        "✅ Portfolio tracking\n" +
        "✅ AI natural language commands\n" +
        "✅ Token launching via IPFS/Metaplex",
        Markup.inlineKeyboard([
            [Markup.button.callback("💳 How to Deposit?", "deposit_guide")],
            [Markup.button.callback("🏠 Main Menu", "main_menu")]
        ])
    );
});

bot.action('deposit_guide', async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { wallets: true }
    });

    const currentChain = user?.activeChain || "solana";
    const chainType = (currentChain === 'ethereum' || currentChain === 'base') ? 'evm' : 'solana';
    const activeWallet = user?.wallets.find(w => w.chain === chainType);

    if (!user || !activeWallet) {
        return ctx.reply("❌ Generate a wallet first!");
    }

    await ctx.answerCbQuery();
    
    const assetName = (currentChain === 'ethereum' || currentChain === 'base') ? 'ETH' : 'SOL';
    const chainDisplay = currentChain.toUpperCase();

    return ctx.replyWithMarkdown(
        `📥 *How to Deposit ${assetName} to ${chainDisplay}*\n\n` +
        `To start trading, you need to send ${assetName} to your ${chainDisplay} bot wallet:\n\n` +
        `📍 *Your ${chainDisplay} Address:* \`${activeWallet.publicKey}\`\n\n` +
        "1️⃣ Copy your address above\n" +
        "2️⃣ Send funds from an exchange or another wallet\n" +
        "3️⃣ Wait for confirmation (~30s for Solana/Base, longer for Eth)\n\n" +
        `💡 *Important:* Only send ${assetName} assets to this address on the ${chainDisplay} network!`,
        Markup.inlineKeyboard([
            [Markup.button.url("🌐 View Explorer", currentChain === 'solana' 
                ? `https://solscan.io/account/${activeWallet.publicKey}`
                : currentChain === 'ethereum' 
                    ? `https://etherscan.io/address/${activeWallet.publicKey}`
                    : `https://basescan.org/address/${activeWallet.publicKey}`
            )],
            [Markup.button.callback("💰 Check Balance", "check_balance")],
            [Markup.button.callback("🏠 Main Menu", "main_menu")]
        ])
    );
});

// Feature modules — registered AFTER core commands
registerReferralCommands();
registerSwapCommands();
registerAlertCommands();
registerAICommands();      
registerLaunchCommands();    
registerPortfolioCommands(); 
registerHistoryCommands();
registerWatchlistCommands();
registerWalletCommands();

bot.catch((err, ctx: Context) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again.');
});

// Health check
const PORT = process.env.PORT || 3000;
createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    }));
}).listen(PORT, () => console.log(`🌐 Health check on port ${PORT}`));

// Launch
async function startBot() {
    try {
        await prisma.$connect();
        console.log("✅ Connected to PostgreSQL");

        await bot.telegram.setMyCommands([
            { command: 'start', description: '🏠 Main menu' },
            { command: 'help', description: '📖 Show all commands' },
            { command: 'about', description: 'ℹ️ About SolBot V3' },
            { command: 'swap', description: '🔄 Swap tokens (e.g. /swap SOL USDC 1)' },
            { command: 'price', description: '💰 Get token price (e.g. /price SOL)' },
            { command: 'portfolio', description: '📊 View your portfolio' },
            { command: 'launch', description: '🚀 Launch a new token' },
            { command: 'ai', description: '🤖 AI assistant (e.g. /ai swap 1 SOL to USDC)' },
            { command: 'cancel', description: '❌ Cancel current operation' },
            { command: 'history', description: '📜 View transaction history' },
            { command: 'alert', description: '🔔 Set price alert (e.g. /alert SOL above 200)' },
            { command: 'alerts', description: '📋 View all price alerts' },
            { command: 'watch', description: '👁️ Add token to watchlist (e.g. /watch SOL)' },
            { command: 'watchlist', description: '👁️ View your token watchlist' },
            { command: 'referral', description: '👥 View referral stats & your link' },
        ]);
        console.log("✅ Commands registered");

        console.log("🚀 Launching bot...");
        bot.launch();
        console.log("✅ SolBot V3 is live!");
        startAlertChecker(bot);
    } catch (error) {
        console.error("❌ Startup failed:", error);
        process.exit(1);
    }
}

startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));