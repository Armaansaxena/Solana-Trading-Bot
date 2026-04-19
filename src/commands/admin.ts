import { bot } from "../bot";
import { getNetworkType, setNetworkType } from "../services/rpc";
import { getFeePercentage, setFeePercentage } from "../services/redis";
import { Markup } from "telegraf";
import * as dotenv from "dotenv";

dotenv.config();

// You can add your Telegram ID here or in .env
const DEVELOPER_ID = process.env.DEVELOPER_ID ? BigInt(process.env.DEVELOPER_ID) : null;

export function registerAdminCommands() {
    // Hidden command for developer
    bot.command('network', async (ctx) => {
        const userId = BigInt(ctx.from!.id);
        
        if (DEVELOPER_ID && userId !== DEVELOPER_ID) {
            return; // Ignore if not developer
        }

        const current = await getNetworkType();
        const next = current === "mainnet" ? "devnet" : "mainnet";

        return ctx.replyWithMarkdown(
            `🌐 *Network Settings*\n\n` +
            `Current Mode: \`${current.toUpperCase()}\`\n\n` +
            `_Switching to ${next.toUpperCase()} will affect all users and refresh all RPC connections._`,
            Markup.inlineKeyboard([
                [Markup.button.callback(`🚀 Switch to ${next.toUpperCase()}`, `toggle_network_${next}`)],
                [Markup.button.callback('❌ Close', 'delete_msg')]
            ])
        );
    });

    bot.command('setfee', async (ctx) => {
        const userId = BigInt(ctx.from!.id);
        if (DEVELOPER_ID && userId !== DEVELOPER_ID) return;

        const args = ctx.message.text.split(" ").slice(1);
        if (args.length !== 1) {
            const currentFee = await getFeePercentage();
            return ctx.replyWithMarkdown(`❌ Usage: \`/setfee <percentage>\`\nExample: \`/setfee 0.5\` for 0.5%\n\nCurrent Fee: *${(currentFee * 100).toFixed(2)}%*`);
        }

        const newFeePercent = parseFloat(args[0]!);
        if (isNaN(newFeePercent) || newFeePercent < 0 || newFeePercent > 100) {
            return ctx.reply("❌ Invalid fee percentage. Must be a number between 0 and 100.");
        }

        // Convert 0.5 to 0.005
        const feeDecimal = newFeePercent / 100;
        await setFeePercentage(feeDecimal);

        return ctx.replyWithMarkdown(`✅ *Global Fee Updated!*\n\nNew Fee: *${newFeePercent.toFixed(2)}%*`);
    });

    bot.action(/^toggle_network_(mainnet|devnet)$/, async (ctx) => {
        const userId = BigInt(ctx.from!.id);
        if (DEVELOPER_ID && userId !== DEVELOPER_ID) return ctx.answerCbQuery("❌ Unauthorized");

        const target = (ctx as any).match[1] as "mainnet" | "devnet";
        
        await ctx.answerCbQuery(`Switching to ${target.toUpperCase()}...`);
        await setNetworkType(target);

        return ctx.editMessageText(
            `✅ *Global Network Switched*\n\n` +
            `The bot is now running on: \`${target.toUpperCase()}\`\n\n` +
            `_RPC providers have been refreshed._`,
            { parse_mode: "Markdown" }
        );
    });

    // Integrated into Settings menu
    bot.action('settings_menu', async (ctx) => {
        const current = await getNetworkType();
        const userId = BigInt(ctx.from!.id);
        const isDev = DEVELOPER_ID && userId === DEVELOPER_ID;

        await ctx.answerCbQuery();
        
        let message = `⚙️ *Settings*\n\n` +
                      `🌐 *Bot Network:* \`${current.toUpperCase()}\`\n` +
                      `🔐 *Encryption:* AES-256-GCM\n` +
                      `📡 *RPC Status:* Optimal\n\n`;
        
        const buttons = [];
        if (isDev) {
            buttons.push([Markup.button.callback(`🔄 Toggle to ${current === 'mainnet' ? 'DEVNET' : 'MAINNET'}`, `toggle_network_${current === 'mainnet' ? 'devnet' : 'mainnet'}`)]);
        }
        buttons.push([Markup.button.callback('🔙 Back', 'more_tools_menu')]);

        return ctx.editMessageText(message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons)
        });
    });
}
