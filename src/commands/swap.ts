import { bot } from "../bot";
import { getUserKeypair } from "../services/solana";
import { getEVMKeypair } from "../services/evm";
import { getEVMQuote, executeEVMSwap } from "../services/evm_swap";
import {
    getQuote,
    executeSwap,
    formatTokenAmount,
} from "../services/jupiter";
import { mainKeyboard } from "../keyboards";
import { prisma } from "../services/db";
import { Markup } from "telegraf";
import { getSession, setSession, clearSession } from "../services/redis";
import type { Context } from "telegraf";

export function registerSwapCommands() {

    bot.action("swap_menu", async (ctx: Context) => {
        const userId = ctx.from!.id;
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        const chain = (user?.activeChain || "solana").toUpperCase();

        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🔄 *${chain} Token Swap*\n\n` +
            `Swap tokens instantly using ${chain === 'SOLANA' ? 'Raydium' : '1inch Aggregator'}\n\n` +
            `*How to use:*\n` +
            `\`/swap FROM TO AMOUNT\`\n\n` +
            `*Example:*\n` +
            `\`/swap ${chain === 'SOLANA' ? 'SOL USDC 1' : 'ETH USDC 0.1'}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback("🏠 Main Menu", "main_menu")],
            ])
        );
    });

    bot.command("swap", async (ctx) => {
        const userId = ctx.from!.id;
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        const chain = user?.activeChain || "solana";

        const args = (ctx.message as any).text.split(" ").slice(1);
        if (args.length !== 3) {
            return ctx.replyWithMarkdown(`❌ Usage: \`/swap FROM TO AMOUNT\``);
        }

        const [fromToken, toToken, amountStr] = args;
        const amount = parseFloat(amountStr ?? "0");
        if (isNaN(amount) || amount <= 0) return ctx.reply("❌ Invalid amount.");

        try {
            await ctx.replyWithMarkdown(`⏳ *Getting best route on ${chain.toUpperCase()}...*`);

            let outAmount = "0";
            let priceImpact = "0";

            if (chain === "solana") {
                const quote = await getQuote(fromToken!, toToken!, amount);
                if (!quote) return ctx.reply("❌ No route found.");
                outAmount = formatTokenAmount(quote.outAmount, toToken!);
                priceImpact = quote.priceImpactPct;
            } else {
                const quote = await getEVMQuote(fromToken!, toToken!, amount, chain as any, "0x0000000000000000000000000000000000000000"); // Address only for quote
                if (!quote) return ctx.reply("❌ No route found.");
                outAmount = ethers.formatUnits(quote.toAmount, 6); // Mocked USDC decimals
                priceImpact = "0.5";
            }

            await setSession(userId, {
                waitingForSwapAmount: true,
                swapFromToken: fromToken?.toUpperCase(),
                swapToToken: toToken?.toUpperCase(),
                sendAmount: amount,
            });

            return ctx.replyWithMarkdown(
                `🔄 *Swap Preview (${chain.toUpperCase()})*\n\n` +
                `📤 Pay: \`${amount} ${fromToken?.toUpperCase()}\`\n` +
                `📥 Get: \`~${outAmount} ${toToken?.toUpperCase()}\`\n` +
                `📊 Impact: ${priceImpact}%\n\n` +
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
            return ctx.reply("❌ Error processing swap.");
        }
    });

    bot.action("confirm_swap", async (ctx) => {
        const userId = ctx.from!.id;
        const session = await getSession(userId);
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

        if (!session?.swapFromToken || !session?.sendAmount) return ctx.reply("❌ Session expired.");

        await ctx.answerCbQuery("Executing...");
        const chain = user?.activeChain || "solana";

        try {
            let signature = "";
            if (chain === "solana") {
                const kp = await getUserKeypair(userId);
                signature = await executeSwap(kp!, session.swapFromToken, session.swapToToken!, session.sendAmount) || "";
            } else {
                const kp = await getEVMKeypair(userId, chain as any);
                if (!kp) throw new Error("Could not retrieve keypair");
                signature = await executeEVMSwap(kp, session.swapFromToken, session.swapToToken!, session.sendAmount, chain as any) || "";
            }

            await clearSession(userId);
            if (!signature) return ctx.reply("❌ Swap failed. Check balance or slippage.");

            return ctx.replyWithMarkdown(
                `✅ *Swap Successful!*\n\n` +
                `🔗 *Hash:* \`${signature}\``,
                mainKeyboard(chain)
            );
        } catch (error: any) {
            console.error("Swap execute error:", error);
            await clearSession(userId);
            return ctx.reply(`❌ Swap failed: ${error.message}`);
        }
    });

    bot.action("cancel_swap", async (ctx) => {
        await clearSession(ctx.from!.id);
        await ctx.answerCbQuery("Cancelled");
        try {
            return await ctx.editMessageText("❌ Swap cancelled.", { reply_markup: mainKeyboard().reply_markup });
        } catch (e) {
            return ctx.reply("❌ Swap cancelled.", mainKeyboard());
        }
    });
}

import { ethers } from "ethers";
