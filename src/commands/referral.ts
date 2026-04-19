import { bot } from "../bot";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { prisma } from "../services/db";

export function registerReferralCommands() {

    // Handle /start with referral code
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const startPayload = (ctx as any).startPayload;

        if (startPayload && startPayload.startsWith('ref_')) {
            const referrerId = parseInt(startPayload.replace('ref_', ''));

            if (referrerId && referrerId !== userId) {
                try {
                    // Check if user already referred
                    const existing = await prisma.referral.findUnique({
                        where: { referredId: BigInt(userId) }
                    });

                    if (!existing) {
                        await prisma.referral.create({
                            data: {
                                referrerId: BigInt(referrerId),
                                referredId: BigInt(userId),
                            }
                        });

                        // Notify referrer
                        try {
                            await bot.telegram.sendMessage(
                                referrerId.toString(),
                                `🎉 *New Referral!*\n\n` +
                                `Someone joined SolBot V2 using your referral link!\n\n` +
                                `_Check your referral stats with /referral_`,
                                { parse_mode: "Markdown" }
                            );
                        } catch (e) {}
                    }
                } catch (e) {}
            }
        }
    });

    bot.command('referral', async (ctx) => {
        const userId = ctx.from.id;
        await showReferralStats(ctx, userId);
    });

    bot.action('referral_menu', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery();
        await showReferralStats(ctx, userId);
    });
}

async function showReferralStats(ctx: any, userId: number) {
    try {
        // Get referral count
        const referralCount = await prisma.referral.count({
            where: { referrerId: BigInt(userId) }
        });

        // Get recent referrals
        const recentReferrals = await prisma.referral.findMany({
            where: { referrerId: BigInt(userId) },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });

        // Check if user was referred by someone
        const wasReferred = await prisma.referral.findUnique({
            where: { referredId: BigInt(userId) }
        });

        // Generate referral link
        const botUsername = (await bot.telegram.getMe()).username;
        const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

        let message = `👥 *Referral Program*\n\n`;
        message += `🔗 *Your Referral Link:*\n\`${referralLink}\`\n\n`;
        message += `📊 *Stats:*\n`;
        message += `• Total Referrals: *${referralCount}*\n`;

        if (wasReferred) {
            message += `• You were referred by a friend ✅\n`;
        }

        message += `\n`;

        if (recentReferrals.length > 0) {
            message += `*Recent Referrals:*\n`;
            for (const ref of recentReferrals) {
                const date = ref.createdAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
                message += `• User joined on ${date}\n`;
            }
        } else {
            message += `_No referrals yet. Share your link to get started!_\n`;
        }

        message += `\n💡 *How it works:*\n`;
        message += `1. Share your referral link\n`;
        message += `2. Friend clicks and joins SolBot V2\n`;
        message += `3. You both get credited!\n`;

        return ctx.replyWithMarkdown(
            message,
            Markup.inlineKeyboard([
                [Markup.button.url('📤 Share Link', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join me on SolBot V2 — The best Solana trading bot!')}`)],
                [Markup.button.callback('🔄 Refresh Stats', 'referral_menu')],
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    } catch (error) {
        console.error("Referral error:", error);
        return ctx.reply("❌ Error loading referral stats.", mainKeyboard());
    }
}