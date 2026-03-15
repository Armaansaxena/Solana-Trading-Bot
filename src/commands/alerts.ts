import { bot } from "../bot";
import { prisma } from "../services/solana";
import { getQuote, TOKEN_MINTS, formatTokenAmount } from "../services/jupiter";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Separate prisma instance for alert polling
const alertAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const alertPrisma = new PrismaClient({ adapter: alertAdapter });

export function registerAlertCommands() {

    bot.command('alert', async (ctx) => {
        const args = (ctx.message as any).text.split(' ').slice(1);

        // /alert SOL above 200
        // /alert SOL below 150
        if (args.length !== 3) {
            return ctx.replyWithMarkdown(
                `🔔 *Price Alerts*\n\n` +
                `*Usage:*\n` +
                `\`/alert SOL above 200\` — alert when SOL goes above $200\n` +
                `\`/alert SOL below 150\` — alert when SOL drops below $150\n\n` +
                `*Supported tokens:*\n` +
                `SOL • USDC • USDT • BONK • JUP • WIF\n\n` +
                `*Manage alerts:*\n` +
                `\`/alerts\` — view all your alerts`
            );
        }

        const [token, condition, priceStr] = args;
        const tokenUpper = token?.toUpperCase();
        const targetPrice = parseFloat(priceStr ?? "0");

        if (!TOKEN_MINTS[tokenUpper ?? ""]) {
            return ctx.replyWithMarkdown(
                `❌ Unknown token: *${token}*\n\nSupported: SOL, USDC, USDT, BONK, JUP, WIF`
            );
        }

        if (condition !== 'above' && condition !== 'below') {
            return ctx.reply("❌ Condition must be 'above' or 'below'\n\nExample: /alert SOL above 200");
        }

        if (isNaN(targetPrice) || targetPrice <= 0) {
            return ctx.reply("❌ Invalid price. Enter a positive number.");
        }

        const userId = ctx.from.id;

        // Check existing alerts limit
        const existingAlerts = await alertPrisma.alert.count({
            where: { telegramId: BigInt(userId), triggered: false }
        });

        if (existingAlerts >= 10) {
            return ctx.reply("❌ Maximum 10 active alerts allowed. Delete some with /alerts");
        }

        await alertPrisma.alert.create({
            data: {
                telegramId: BigInt(userId),
                token: tokenUpper!,
                targetPrice,
                condition: condition!,
                triggered: false,
            }
        });

        // Get current price for reference
        let currentPrice = "N/A";
        try {
            const quote = await getQuote(tokenUpper!, "USDC", 1);
            if (quote) currentPrice = `$${formatTokenAmount(quote.outAmount, "USDC")}`;
        } catch (e) {}

        return ctx.replyWithMarkdown(
            `🔔 *Alert Created!*\n\n` +
            `📊 Token: *${tokenUpper}*\n` +
            `🎯 Condition: *${condition} $${targetPrice}*\n` +
            `💰 Current Price: *${currentPrice}*\n\n` +
            `_You'll be notified when the price hits your target._`,
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 My Alerts', 'alerts_menu')],
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    });

    bot.command('alerts', async (ctx) => {
        const userId = ctx.from.id;
        await showAlerts(ctx, userId);
    });

    bot.action('alerts_menu', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery();
        await showAlerts(ctx, userId);
    });

    bot.action(/delete_alert_(\d+)/, async (ctx) => {
        const alertId = parseInt((ctx.match as RegExpMatchArray)[1] ?? "0");
        const userId = ctx.from!.id;

        try {
            await alertPrisma.alert.deleteMany({
                where: { id: alertId, telegramId: BigInt(userId) }
            });
            await ctx.answerCbQuery("✅ Alert deleted");
            await showAlerts(ctx, userId);
        } catch (error) {
            await ctx.answerCbQuery("❌ Error deleting alert");
        }
    });

    bot.action('delete_all_alerts', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `⚠️ *Delete All Alerts?*\n\nThis will remove all your active alerts.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Delete All', 'confirm_delete_all_alerts')],
                [Markup.button.callback('❌ Cancel', 'alerts_menu')]
            ])
        );
    });

    bot.action('confirm_delete_all_alerts', async (ctx) => {
        const userId = ctx.from!.id;
        await alertPrisma.alert.deleteMany({
            where: { telegramId: BigInt(userId) }
        });
        await ctx.answerCbQuery("✅ All alerts deleted");
        return ctx.replyWithMarkdown("✅ *All alerts deleted.*", mainKeyboard());
    });
}

async function showAlerts(ctx: any, userId: number) {
    const alerts = await alertPrisma.alert.findMany({
        where: { telegramId: BigInt(userId), triggered: false },
        orderBy: { createdAt: 'desc' }
    });

    if (alerts.length === 0) {
        return ctx.replyWithMarkdown(
            `🔔 *Price Alerts*\n\n` +
            `No active alerts.\n\n` +
            `Create one with:\n` +
            `\`/alert SOL above 200\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    }

    let message = `🔔 *Price Alerts*\n\n_${alerts.length} active alert(s)_\n\n`;

    const buttons = [];
    for (const alert of alerts) {
        const emoji = alert.condition === 'above' ? '📈' : '📉';
        message += `${emoji} *${alert.token}* ${alert.condition} *$${alert.targetPrice}*\n`;
        buttons.push([
            Markup.button.callback(
                `🗑️ Delete ${alert.token} ${alert.condition} $${alert.targetPrice}`,
                `delete_alert_${alert.id}`
            )
        ]);
    }

    buttons.push([Markup.button.callback('🗑️ Delete All', 'delete_all_alerts')]);
    buttons.push([Markup.button.callback('🏠 Main Menu', 'main_menu')]);

    return ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
}

// Price checker — runs every 30 seconds
export async function startAlertChecker(botInstance: any) {
    console.log("🔔 Price alert checker started");

    setInterval(async () => {
        try {
            const activeAlerts = await alertPrisma.alert.findMany({
                where: { triggered: false }
            });

            if (activeAlerts.length === 0) return;

            // Get unique tokens
            const tokens = [...new Set(activeAlerts.map(a => a.token))];

            // Fetch prices for all tokens
            const prices: Record<string, number> = {};
            for (const token of tokens) {
                try {
                    const quote = await getQuote(token, "USDC", 1);
                    if (quote) {
                        prices[token] = parseInt(quote.outAmount) / 1e6;
                    }
                } catch (e) {}
            }

            // Check each alert
            for (const alert of activeAlerts) {
                const currentPrice = prices[alert.token];
                if (!currentPrice) continue;

                const triggered =
                    (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
                    (alert.condition === 'below' && currentPrice <= alert.targetPrice);

                if (triggered) {
                    // Mark as triggered
                    await alertPrisma.alert.update({
                        where: { id: alert.id },
                        data: { triggered: true }
                    });

                    // Send notification
                    const emoji = alert.condition === 'above' ? '📈' : '📉';
                    await botInstance.telegram.sendMessage(
                        alert.telegramId.toString(),
                        `🔔 *Price Alert Triggered!*\n\n` +
                        `${emoji} *${alert.token}* is now *$${currentPrice.toFixed(4)}*\n\n` +
                        `Your target: ${alert.condition} $${alert.targetPrice}\n\n` +
                        `_Alert has been removed._`,
                        { parse_mode: "Markdown" }
                    );
                }
            }
        } catch (error) {
            console.error("Alert checker error:", error);
        }
    }, 30000); // every 30 seconds
}