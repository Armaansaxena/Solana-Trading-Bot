import { bot } from "../bot";
import { prisma } from "../services/solana";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";

export function registerHistoryCommands() {

    bot.command('history', async (ctx) => {
        const userId = ctx.from.id;
        await showHistory(ctx, userId);
    });

    bot.action('history_menu', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery("Loading history...");
        await showHistory(ctx, userId);
    });

    bot.action(/history_page_(\d+)/, async (ctx) => {
        const userId = ctx.from!.id;
        const page = parseInt((ctx.match as RegExpMatchArray)[1] ?? "0");
        await ctx.answerCbQuery();
        await showHistory(ctx, userId, page);
    });
}

async function showHistory(ctx: any, userId: number, page: number = 0) {
    try {
        const PAGE_SIZE = 5;
        const skip = page * PAGE_SIZE;

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { telegramId: BigInt(userId) },
                orderBy: { createdAt: 'desc' },
                take: PAGE_SIZE,
                skip,
            }),
            prisma.transaction.count({
                where: { telegramId: BigInt(userId) }
            })
        ]);

        if (total === 0) {
            return ctx.replyWithMarkdown(
                `📜 *Transaction History*\n\n` +
                `No transactions yet.\n\n` +
                `Start by sending SOL, swapping tokens, or launching a token!`,
                mainKeyboard()
            );
        }

        const totalPages = Math.ceil(total / PAGE_SIZE);

        let message = `📜 *Transaction History*\n`;
        message += `_Page ${page + 1}/${totalPages} • ${total} total_\n\n`;

        for (const tx of transactions) {
            const date = tx.createdAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusEmoji = tx.status === 'success' ? '✅' : '❌';
            const typeEmoji = getTypeEmoji(tx.type);

            message += `${statusEmoji} ${typeEmoji} *${formatTxType(tx.type)}*\n`;
            message += `   ${formatTxDetails(tx)}\n`;
            message += `   🔗 [Solscan](https://solscan.io/tx/${tx.signature})\n`;
            message += `   _${date}_\n\n`;
        }

        // Pagination buttons
        const buttons = [];
        const navRow = [];

        if (page > 0) {
            navRow.push(Markup.button.callback('◀️ Prev', `history_page_${page - 1}`));
        }
        if (page < totalPages - 1) {
            navRow.push(Markup.button.callback('Next ▶️', `history_page_${page + 1}`));
        }
        if (navRow.length > 0) buttons.push(navRow);
        buttons.push([Markup.button.callback('🏠 Main Menu', 'main_menu')]);

        return ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
        console.error("History error:", error);
        return ctx.reply("❌ Error loading history.", mainKeyboard());
    }
}

function getTypeEmoji(type: string): string {
    switch (type) {
        case 'send': return '💸';
        case 'swap': return '🔄';
        case 'launch': return '🚀';
        default: return '📝';
    }
}

function formatTxType(type: string): string {
    switch (type) {
        case 'send': return 'Sent SOL';
        case 'swap': return 'Swap';
        case 'launch': return 'Token Launch';
        default: return type;
    }
}

function formatTxDetails(tx: any): string {
    switch (tx.type) {
        case 'send':
            return `${tx.amount} SOL`;
        case 'swap':
            return `${tx.amount} ${tx.fromToken} → ${tx.toToken}`;
        case 'launch':
            return `${tx.fromToken} (${tx.toToken})`;
        default:
            return `${tx.amount}`;
    }
}