import { bot, SESSION } from "../bot";
import { getUserKeypair, saveTransaction } from "../services/solana";
import {
    getQuote,
    executeSwap,
    formatTokenAmount,
    TOKEN_MINTS,
} from "../services/jupiter";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { getSession, setSession, clearSession } from "../services/redis";
import type { Context } from "telegraf";

export function registerSwapCommands() {

    bot.action("swap_menu", async (ctx: Context) => {
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🔄 *Token Swap*\n\n` +
            `Swap any token instantly via Raydium\n\n` +
            `*Supported tokens:*\n` +
            `SOL • USDC • USDT • BONK • JUP • WIF\n\n` +
            `*How to use:*\n` +
            `\`/swap SOL USDC 1\` — swap 1 SOL to USDC\n` +
            `\`/swap USDC SOL 10\` — swap 10 USDC to SOL\n\n` +
            `*Get price:*\n` +
            `\`/price SOL\` — get current SOL price`,
            Markup.inlineKeyboard([
                [Markup.button.callback("🏠 Main Menu", "main_menu")],
            ])
        );
    });

    bot.command("swap", async (ctx) => {
        const userId = ctx.from!.id;
        const args = (ctx.message as any).text.split(" ").slice(1);

        if (args.length !== 3) {
            return ctx.replyWithMarkdown(
                `❌ *Invalid format*\n\n` +
                `Usage: \`/swap FROM TO AMOUNT\`\n\n` +
                `Example: \`/swap SOL USDC 1\``
            );
        }

        const [fromToken, toToken, amountStr] = args;
        const amount = parseFloat(amountStr ?? "0");

        if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Invalid amount. Please enter a positive number.");
        }

        if (!TOKEN_MINTS[fromToken?.toUpperCase() ?? ""]) {
            return ctx.replyWithMarkdown(
                `❌ Unknown token: *${fromToken}*\n\nSupported: SOL, USDC, USDT, BONK, JUP, WIF`
            );
        }

        if (!TOKEN_MINTS[toToken?.toUpperCase() ?? ""]) {
            return ctx.replyWithMarkdown(
                `❌ Unknown token: *${toToken}*\n\nSupported: SOL, USDC, USDT, BONK, JUP, WIF`
            );
        }

        try {
            const keypair = await getUserKeypair(userId);
            if (!keypair) {
                return ctx.reply("❌ No wallet found. Use /start to create one.", mainKeyboard());
            }

            await ctx.replyWithMarkdown(`⏳ *Getting best route...*`);

            const quote = await getQuote(fromToken!, toToken!, amount);
            if (!quote) {
                return ctx.reply("❌ Could not get quote. Try again later.");
            }

            const outAmount = formatTokenAmount(quote.outAmount, toToken!);
            const priceImpact = parseFloat(quote.priceImpactPct).toFixed(3);

            await setSession(userId, {
                waitingForSwapAmount: true,
                swapFromToken: fromToken,
                swapToToken: toToken,
                sendAmount: amount,
            });

            return ctx.replyWithMarkdown(
                `🔄 *Swap Preview*\n\n` +
                `📤 You pay: \`${amount} ${fromToken?.toUpperCase()}\`\n` +
                `📥 You get: \`${outAmount} ${toToken?.toUpperCase()}\`\n` +
                `📊 Price impact: ${priceImpact}%\n` +
                `⚡ Slippage: 0.5%\n\n` +
                `_Confirm to execute swap_`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback("✅ Confirm Swap", "confirm_swap"),
                        Markup.button.callback("❌ Cancel", "cancel_swap"),
                    ],
                ])
            );
        } catch (error) {
            console.error("Swap command error:", error);
            return ctx.reply("❌ Error processing swap. Please try again.");
        }
    });

    bot.action("confirm_swap", async (ctx) => {
        const userId = ctx.from!.id;
        const session = await getSession(userId);

        if (!session?.swapFromToken || !session?.swapToToken || !session?.sendAmount) {
            await ctx.answerCbQuery("❌ Session expired");
            return ctx.reply("❌ Session expired. Please run /swap again.");
        }

        await ctx.answerCbQuery("Executing swap...");
        await ctx.replyWithMarkdown(
            `⏳ *Executing Swap...*\n\n` +
            `Swapping ${session.sendAmount} ${session.swapFromToken} → ${session.swapToToken}\n\n` +
            `_This may take a few seconds_`
        );

        try {
            const keypair = await getUserKeypair(userId);
            if (!keypair) return ctx.reply("❌ No wallet found.");

            const signature = await executeSwap(
                keypair,
                session.swapFromToken,
                session.swapToToken,
                session.sendAmount
            );

            await clearSession(userId);

            if (!signature) {
                return ctx.replyWithMarkdown(
                    `❌ *Swap Failed*\n\n` +
                    `Could not execute swap. Please try again.\n\n` +
                    `_Note: Swap execution requires Mainnet_`,
                    mainKeyboard()
                );
            }

            // Save to history
            await saveTransaction(
                userId, 'swap', session.sendAmount,
                signature, 'success',
                session.swapFromToken, session.swapToToken
            );

            return ctx.replyWithMarkdown(
                `✅ *Swap Successful!*\n\n` +
                `📤 Sold: ${session.sendAmount} ${session.swapFromToken}\n` +
                `📥 Bought: ${session.swapToToken}\n\n` +
                `🔗 [View on Solscan](https://solscan.io/tx/${signature})`,
                Markup.inlineKeyboard([
                    [Markup.button.url("🌐 Explorer", `https://explorer.solana.com/tx/${signature}`)],
                    [Markup.button.callback("🔄 Swap Again", "swap_menu"), Markup.button.callback("🏠 Menu", "main_menu")]
                ])
            );
        } catch (error) {
            await clearSession(userId);
            console.error("Confirm swap error:", error);
            return ctx.reply("❌ Swap failed. Please try again.", mainKeyboard());
        }
    });

    bot.action("cancel_swap", async (ctx: Context) => {
        const userId = ctx.from!.id;
        await clearSession(userId);
        await ctx.answerCbQuery("Cancelled");
        return ctx.replyWithMarkdown("❌ *Swap cancelled.*", mainKeyboard());
    });

    bot.command("price", async (ctx) => {
        const args = (ctx.message as any).text.split(" ").slice(1);
        const token = args[0]?.toUpperCase();

        if (!token) {
            return ctx.reply("Usage: /price SOL");
        }

        if (!TOKEN_MINTS[token]) {
            return ctx.replyWithMarkdown(
                `❌ Unknown token: *${token}*\n\nSupported: SOL, USDC, USDT, BONK, JUP, WIF`
            );
        }

        try {
            await ctx.replyWithMarkdown(`⏳ Fetching ${token} price...`);
            const quote = await getQuote(token, "USDC", 1);
            if (!quote) return ctx.reply("❌ Could not fetch price.");

            const price = formatTokenAmount(quote.outAmount, "USDC");

            return ctx.replyWithMarkdown(
                `💰 *${token} Price*\n\n` +
                `1 ${token} = $${price} USDC\n\n` +
                `_Powered by Raydium_`,
                Markup.inlineKeyboard([
                    [Markup.button.callback(`🔄 Swap ${token}`, "swap_menu")],
                    [Markup.button.callback("🏠 Main Menu", "main_menu")],
                ])
            );
        } catch (error) {
            return ctx.reply("❌ Error fetching price.");
        }
    });
}