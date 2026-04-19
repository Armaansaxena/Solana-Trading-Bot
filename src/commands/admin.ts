import { bot } from "../bot";
import { getNetworkType, setNetworkType } from "../services/rpc";
import { getFeePercentage, setFeePercentage, setSession } from "../services/redis";
import { Markup } from "telegraf";
import * as dotenv from "dotenv";

dotenv.config();

const DEVELOPER_ID = process.env.DEVELOPER_ID ? BigInt(process.env.DEVELOPER_ID) : null;

export function registerAdminCommands() {
    
    // --- MAIN ADMIN / NETWORK MENU ---
    bot.command('network', async (ctx) => {
        const userId = BigInt(ctx.from!.id);
        if (DEVELOPER_ID && userId !== DEVELOPER_ID) return;

        return showAdminMenu(ctx);
    });

    async function showAdminMenu(ctx: any) {
        const currentNet = await getNetworkType();
        const currentFee = await getFeePercentage();
        
        const message = `🛠️ *Admin Control Panel*\n\n` +
                        `🌐 *Network:* \`${currentNet.toUpperCase()}\`\n` +
                        `💰 *Current Fee:* \`${(currentFee * 100).toFixed(2)}%\`\n\n` +
                        `_Select an action below to manage global bot settings._`;

        const nextNet = currentNet === "mainnet" ? "devnet" : "mainnet";

        return ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
            [Markup.button.callback(`🔄 Switch to ${nextNet.toUpperCase()}`, `toggle_network_${nextNet}`)],
            [Markup.button.callback(`💸 Adjust Fees`, `admin_fee_menu`)],
            [Markup.button.callback('❌ Close', 'delete_msg')]
        ]));
    }

    // --- FEE MANAGEMENT ---
    bot.action('admin_fee_menu', async (ctx) => {
        const currentFee = await getFeePercentage();
        await ctx.answerCbQuery();
        
        return ctx.editMessageText(
            `💸 *Fee Management*\n\nCurrent Global Fee: \`${(currentFee * 100).toFixed(2)}%\`\n\n` +
            `Choose a preset or send a custom value:`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('0.1%', 'set_preset_fee_0.1'),
                        Markup.button.callback('0.5%', 'set_preset_fee_0.5'),
                        Markup.button.callback('1.0%', 'set_preset_fee_1.0')
                    ],
                    [Markup.button.callback('⌨️ Custom Value', 'custom_fee_prompt')],
                    [Markup.button.callback('🔙 Back', 'admin_main_menu')]
                ])
            }
        );
    });

    bot.action(/^set_preset_fee_(\d+\.?\d*)$/, async (ctx) => {
        const val = parseFloat((ctx as any).match[1]);
        await setFeePercentage(val / 100);
        await ctx.answerCbQuery(`✅ Fee set to ${val}%`);
        return ctx.editMessageText(`✅ *Global fee updated to ${val}%*`, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_fee_menu')]])
        });
    });

    bot.action('custom_fee_prompt', async (ctx) => {
        const userId = ctx.from!.id;
        await setSession(userId, { waitingForCustomFee: true } as any);
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown("⌨️ *Enter new fee percentage (e.g. 0.75):*\n\n_Type /cancel to abort_");
    });

    // --- NETWORK TOGGLE ---
    bot.action(/^toggle_network_(mainnet|devnet)$/, async (ctx) => {
        const userId = BigInt(ctx.from!.id);
        if (DEVELOPER_ID && userId !== DEVELOPER_ID) return ctx.answerCbQuery("❌ Unauthorized");

        const target = (ctx as any).match[1] as "mainnet" | "devnet";
        await ctx.answerCbQuery(`Switching to ${target.toUpperCase()}...`);
        await setNetworkType(target);

        return ctx.editMessageText(
            `✅ *Global Network Switched*\n\n` +
            `The bot is now running on: \`${target.toUpperCase()}\`\n\n` +
            `_All RPC providers have been refreshed._`,
            { 
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_main_menu')]])
            }
        );
    });

    bot.action('admin_main_menu', async (ctx) => {
        const currentNet = await getNetworkType();
        const currentFee = await getFeePercentage();
        const nextNet = currentNet === "mainnet" ? "devnet" : "mainnet";

        await ctx.answerCbQuery();
        return ctx.editMessageText(
            `🛠️ *Admin Control Panel*\n\n` +
            `🌐 *Network:* \`${currentNet.toUpperCase()}\`\n` +
            `💰 *Current Fee:* \`${(currentFee * 100).toFixed(2)}%\`\n\n` +
            `_Select an action below:_`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`🔄 Switch to ${nextNet.toUpperCase()}`, `toggle_network_${nextNet}`)],
                    [Markup.button.callback(`💸 Adjust Fees`, `admin_fee_menu`)],
                    [Markup.button.callback('❌ Close', 'delete_msg')]
                ])
            }
        );
    });

    // --- INTEGRATED SETTINGS ---
    bot.action('settings_menu', async (ctx) => {
        const currentNet = await getNetworkType();
        const currentFee = await getFeePercentage();
        const userId = BigInt(ctx.from!.id);
        const isDev = DEVELOPER_ID && userId === DEVELOPER_ID;

        await ctx.answerCbQuery();
        
        let message = `⚙️ *Settings*\n\n` +
                      `🌐 *Bot Network:* \`${currentNet.toUpperCase()}\`\n` +
                      `💰 *Convenience Fee:* \`${(currentFee * 100).toFixed(2)}%\`\n` +
                      `🔐 *Encryption:* AES-256-GCM\n` +
                      `📡 *RPC Status:* Optimal\n\n`;
        
        const buttons = [];
        if (isDev) {
            buttons.push([Markup.button.callback(`🛠️ Open Admin Panel`, `admin_main_menu`)]);
        }
        buttons.push([Markup.button.callback('🔙 Back', 'more_tools_menu')]);

        return ctx.editMessageText(message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons)
        });
    });
}
