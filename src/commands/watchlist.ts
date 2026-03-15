import { bot } from "../bot";
import { getQuote, TOKEN_MINTS, formatTokenAmount } from "../services/jupiter";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const watchlistPrisma = new PrismaClient({ adapter });

export function registerWatchlistCommands() {

    bot.command('watch', async (ctx) => {
        const args = (ctx.message as any).text.split(' ').slice(1);
        const token = args[0]?.toUpperCase();

        if (!token) {
            return ctx.replyWithMarkdown(
                `👁️ *Watchlist*\n\n` +
                `*Usage:*\n` +
                `\`/watch SOL\` — add SOL to watchlist\n` +
                `\`/watchlist\` — view all watched tokens\n\n` +
                `*Supported tokens:*\n` +
                `SOL • USDC • USDT • BONK • JUP • WIF`
            );
        }

        if (!TOKEN_MINTS[token]) {
            return ctx.replyWithMarkdown(
                `❌ Unknown token: *${token}*\n\nSupported: SOL, USDC, USDT, BONK, JUP, WIF`
            );
        }

        const userId = ctx.from.id;

        try {
            await watchlistPrisma.watchlist.create({
                data: {
                    telegramId: BigInt(userId),
                    token,
                    mintAddress: TOKEN_MINTS[token],
                }
            });

            // Get current price
            let price = "N/A";
            try {
                const quote = await getQuote(token, "USDC", 1);
                if (quote) price = `$${formatTokenAmount(quote.outAmount, "USDC")}`;
            } catch (e) {}

            return ctx.replyWithMarkdown(
                `✅ *${token} added to watchlist!*\n\n` +
                `💰 Current Price: *${price}*\n\n` +
                `_View your watchlist with /watchlist_`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('👁️ View Watchlist', 'watchlist_menu')],
                    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
                ])
            );
        } catch (error: any) {
            if (error.code === 'P2002') {
                return ctx.reply(`❌ ${token} is already in your watchlist!`);
            }
            return ctx.reply("❌ Error adding to watchlist.");
        }
    });

    bot.command('watchlist', async (ctx) => {
        const userId = ctx.from.id;
        await showWatchlist(ctx, userId);
    });

    bot.action('watchlist_menu', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery("Loading watchlist...");
        await showWatchlist(ctx, userId);
    });

    bot.action(/unwatch_(\w+)/, async (ctx) => {
        const token = (ctx.match as RegExpMatchArray)[1]?.toUpperCase();
        const userId = ctx.from!.id;

        try {
            await watchlistPrisma.watchlist.deleteMany({
                where: { telegramId: BigInt(userId), token }
            });
            await ctx.answerCbQuery(`✅ ${token} removed`);
            await showWatchlist(ctx, userId);
        } catch (error) {
            await ctx.answerCbQuery("❌ Error removing token");
        }
    });
}

async function showWatchlist(ctx: any, userId: number) {
    const items = await watchlistPrisma.watchlist.findMany({
        where: { telegramId: BigInt(userId) },
        orderBy: { createdAt: 'asc' }
    });

    if (items.length === 0) {
        return ctx.replyWithMarkdown(
            `👁️ *Watchlist*\n\n` +
            `Your watchlist is empty.\n\n` +
            `Add tokens with:\n` +
            `\`/watch SOL\`\n` +
            `\`/watch BONK\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    }

    await ctx.replyWithMarkdown(`⏳ *Loading prices...*`);

    let message = `👁️ *Watchlist*\n\n`;
    const buttons = [];

    for (const item of items) {
        let price = "N/A";
        let change = "";

        try {
            const quote = await getQuote(item.token, "USDC", 1);
            if (quote) {
                const priceNum = parseInt(quote.outAmount) / 1e6;
                price = `$${priceNum.toFixed(4)}`;
            }
        } catch (e) {}

        message += `🪙 *${item.token}*\n`;
        message += `   💰 Price: ${price}\n\n`;

        buttons.push([
            Markup.button.callback(
                `🗑️ Remove ${item.token}`,
                `unwatch_${item.token.toLowerCase()}`
            )
        ]);
    }

    message += `_Updated just now • Powered by Raydium_`;

    buttons.push([
        Markup.button.callback('🔄 Refresh', 'watchlist_menu'),
        Markup.button.callback('🏠 Menu', 'main_menu')
    ]);

    return ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
}