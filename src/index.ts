import * as dotenv from "dotenv";
dotenv.config();

import { bot } from "./bot";
import { PrismaClient } from "@prisma/client";
import { createServer } from "http";
import { registerWalletCommands } from "./commands/wallet";
import { registerSwapCommands } from "./commands/swap";
import { Markup } from "telegraf";
import type { Context } from "telegraf";
import { registerPortfolioCommands } from "./commands/portfolio";
import { registerLaunchCommands } from "./commands/launch";
import { registerAICommands } from "./commands/ai";
import { registerHistoryCommands } from "./commands/history";
import { PrismaPg } from "@prisma/adapter-pg";
import { registerAlertCommands, startAlertChecker } from "./commands/alerts";
import { registerWatchlistCommands } from "./commands/watchlist";
import { registerReferralCommands } from "./commands/referral";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const prisma = new PrismaClient({adapter});

// Global debug middleware
bot.use((ctx, next) => {
    console.log("📨 Update:", ctx.updateType);
    return next();
});

// Core commands — registered FIRST
bot.start(async (ctx: Context) => {
    console.log("✅ /start received from:", ctx.from?.id);
    return ctx.replyWithMarkdown(
        "🚀 *Welcome to SolBot V2*\n\n" +
        "Your all-in-one Solana trading assistant\n\n" +
        "🔹 *Wallet* — Create, send, export\n" +
        "🔹 *Swap* — Trade any token via Jupiter\n" +
        "🔹 *Portfolio* — Track all your assets\n" +
        "🔹 *Launch* — Deploy tokens on DeAura\n" +
        "🔹 *AI* — Natural language commands\n\n" +
        "🌐 *Network:* Solana Mainnet\n\n" +
        "💡 _Tip: Use /help for all commands_",
        Markup.inlineKeyboard([
            [Markup.button.callback('✨ Generate Wallet', 'generate_wallet')],
            [
                Markup.button.callback('🔍 Public Key', 'show_public_key'),
                Markup.button.callback('💰 Balance', 'check_balance')
            ],
            [
                Markup.button.callback('💸 Send SOL', 'send_sol'),
                Markup.button.callback('🔑 Export Key', 'show_private_key')
            ],
            [
                Markup.button.callback('🔄 Swap', 'swap_menu'),
                Markup.button.callback('📊 Portfolio', 'portfolio')
            ]
        ])
    );
});

bot.command('help', async (ctx: Context) => {
    return ctx.replyWithMarkdown(
        "📖 *SolBot V2 Commands*\n\n" +
        "/start — Main menu\n" +
        "/swap SOL USDC 1 — Swap tokens\n" +
        "/price SOL — Get token price\n" +
        "/portfolio — View all balances\n" +
        "/help — This message\n\n" +
        "*Supported tokens:*\n" +
        "SOL • USDC • USDT • BONK • JUP • WIF"
    );
});

bot.command('about', async (ctx: Context) => {
    return ctx.replyWithMarkdown(
        "ℹ️ *About SolBot V2*\n\n" +
        "🤖 *Version:* 2.0.0\n" +
        "⚡ *Network:* Solana Mainnet\n" +
        "🔐 *Security:* AES-256 encryption\n" +
        "🗄️ *Database:* PostgreSQL\n\n" +
        "🌟 *Features:*\n" +
        "✅ Wallet generation & management\n" +
        "✅ SOL transfers\n" +
        "✅ Token swaps via Jupiter\n" +
        "✅ Portfolio tracking\n" +
        "✅ AI natural language commands\n" +
        "✅ Token launching via DeAura"
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
            { command: 'about', description: 'ℹ️ About SolBot V2' },
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
        console.log("✅ SolBot V2 is live!");
        startAlertChecker(bot);
    } catch (error) {
        console.error("❌ Startup failed:", error);
        process.exit(1);
    }
}

startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));