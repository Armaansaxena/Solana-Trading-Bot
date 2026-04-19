import { bot } from "../bot";
import { getUserKeypair, getBalance } from "../services/solana";
import { getEVMBalance } from "../services/evm";
import { prisma } from "../services/db";
import { getQuote, TOKEN_MINTS, formatTokenAmount } from "../services/jupiter";
import { getEVMQuote } from "../services/evm_swap";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import Groq from "groq-sdk";
import { getSession, setSession, clearSession } from "../services/redis";
import { ethers } from "ethers";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are ArmEthSol AI, a multi-chain trading assistant for Solana, Ethereum, and Base.

Your job is to understand what the user wants to do and respond with a JSON action.

Available actions:
- check_balance: Check balance of current active chain
- check_portfolio: Show full multi-chain portfolio
- swap_tokens: Swap tokens (needs: fromToken, toToken, amount)
- get_price: Get token price (needs: token)
- send_token: Send native token (needs: amount, optional: address)
- launch_token: Launch a new token
- help: Show help
- unknown: Cannot understand the request

Supported tokens: SOL, ETH, USDC, USDT, BONK, JUP, WIF

ALWAYS respond with valid JSON only. No text, no explanation, just JSON.

Format:
{
  "action": "action_name",
  "params": {
    "fromToken": "SOL",
    "toToken": "USDC", 
    "amount": 1.5,
    "token": "SOL",
    "address": "0x... or SolanaAddress"
  },
  "message": "Human readable confirmation of what you understood"
}

Examples:
User: "swap 2 sol to usdc"
{"action":"swap_tokens","params":{"fromToken":"SOL","toToken":"USDC","amount":2},"message":"Swapping 2 SOL to USDC"}

User: "send 0.1 eth to 0x123..."
{"action":"send_token","params":{"amount":0.1, "address":"0x123..."},"message":"Sending 0.1 ETH to 0x123..."}

User: "whats my eth balance"
{"action":"check_balance","params":{},"message":"Checking your balance"}`;

async function parseUserIntent(userMessage: string): Promise<{
    action: string;
    params: Record<string, any>;
    message: string;
} | null> {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage }
            ],
            temperature: 0.1,
            max_tokens: 200,
        });

        const response = completion.choices[0]?.message?.content?.trim();
        if (!response) return null;

        console.log("AI response:", response);

        const parsed = JSON.parse(response);
        return parsed;
    } catch (error) {
        console.error("AI parse error:", error);
        return null;
    }
}

export function registerAICommands() {

    bot.command('ai', async (ctx) => {
        const text = ctx.message.text.replace('/ai', '').trim();
        const userId = ctx.from!.id;
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        const activeChain = user?.activeChain || "solana";

        if (!text) {
            return ctx.replyWithMarkdown(
                `🤖 *AI Assistant (${activeChain.toUpperCase()})*\n\n` +
                `Talk to your wallet in plain English!\n\n` +
                `*Examples:*\n` +
                `• \`/ai swap 2 SOL to USDC\`\n` +
                `• \`/ai what's my balance\`\n` +
                `• \`/ai buy $50 of BONK\`\n` +
                `• \`/ai show my portfolio\`\n` +
                `• \`/ai get SOL price\`\n\n` +
                `_Your active chain is currently ${activeChain.toUpperCase()}_`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
                ])
            );
        }

        await handleAIMessage(ctx, userId, text);
    });

    bot.action('ai_menu', async (ctx) => {
        const userId = ctx.from!.id;
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        const activeChain = user?.activeChain || "solana";

        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🤖 *AI Assistant (${activeChain.toUpperCase()})*\n\n` +
            `Talk to your wallet in plain English!\n\n` +
            `*Try these:*\n` +
            `• \`/ai swap 1 SOL to USDC\`\n` +
            `• \`/ai check my balance\`\n` +
            `• \`/ai buy $20 of BONK\`\n` +
            `• \`/ai show portfolio\`\n\n` +
            `_Type /ai followed by your request_`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Main Menu', 'main_menu')]
            ])
        );
    });
}

async function handleAIMessage(ctx: any, userId: number, text: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            include: { activeWallet: true }
        });

        const activeChain = user?.activeChain || "solana";

        if (!user || !user.activeWallet) {
            return ctx.replyWithMarkdown(
                "❌ No active wallet found. Generate one first with /start",
                mainKeyboard(activeChain)
            );
        }

        const assetSymbol = (activeChain === "ethereum" || activeChain === "base") ? "ETH" : "SOL";

        await ctx.replyWithMarkdown(`🤖 _Thinking (${activeChain.toUpperCase()})..._`);

        const intent = await parseUserIntent(text);

        if (!intent) {
            return ctx.replyWithMarkdown(
                `🤖 Sorry, I couldn't understand that.\n\n` +
                `Try: \`/ai swap 1 SOL to USDC\` or \`/ai check balance\``
            );
        }

        console.log("Intent:", intent);

        switch (intent.action) {
            case "check_balance": {
                let balance = 0;
                if (activeChain === "solana") {
                    balance = await getBalance(new PublicKey(user.activeWallet.publicKey));
                } else {
                    balance = await getEVMBalance(user.activeWallet.publicKey, activeChain as any);
                }

                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `💰 Balance: ${balance.toFixed(4)} ${assetSymbol}\n` +
                    `🌐 Chain: ${activeChain.toUpperCase()}`,
                    mainKeyboard(activeChain)
                );
            }

            case "check_portfolio": {
                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('📊 Open Portfolio', 'portfolio')]
                    ])
                );
            }

            case "get_price": {
                const token = intent.params.token?.toUpperCase();
                if (!token) return ctx.reply("🤖 Please specify a token symbol.");

                if (activeChain === "solana") {
                    if (!TOKEN_MINTS[token]) return ctx.reply(`🤖 Unknown Solana token: ${token}`);
                    const quote = await getQuote(token, "USDC", 1);
                    if (!quote) return ctx.reply("🤖 Could not fetch price right now.");
                    const price = formatTokenAmount(quote.outAmount, "USDC");
                    return ctx.replyWithMarkdown(
                        `🤖 *${intent.message}*\n\n` +
                        `💰 1 ${token} = $${price} USDC`,
                        mainKeyboard(activeChain)
                    );
                } else {
                    const quote = await getEVMQuote(token, "USDC", 1, activeChain as any, "0x0000000000000000000000000000000000000000");
                    if (!quote) return ctx.reply(`🤖 Could not fetch ${activeChain} price for ${token}.`);
                    const price = ethers.formatUnits(quote.toAmount, 6);
                    return ctx.replyWithMarkdown(
                        `🤖 *${intent.message}*\n\n` +
                        `💰 1 ${token} = $${price} USDC (Estimated)`,
                        mainKeyboard(activeChain)
                    );
                }
            }

            case "swap_tokens": {
                const { fromToken, toToken, amount } = intent.params;
                if (!fromToken || !toToken || !amount) {
                    return ctx.reply("🤖 Please specify: from token, to token, and amount.");
                }

                await setSession(userId, {
                    waitingForSwapAmount: true,
                    swapFromToken: fromToken.toUpperCase(),
                    swapToToken: toToken.toUpperCase(),
                    sendAmount: amount
                });

                let outAmount = "0";
                if (activeChain === "solana") {
                    const quote = await getQuote(fromToken, toToken, amount);
                    if (!quote) return ctx.reply("🤖 Could not get swap quote.");
                    outAmount = formatTokenAmount(quote.outAmount, toToken);
                } else {
                    const quote = await getEVMQuote(fromToken, toToken, amount, activeChain as any, "0x0000000000000000000000000000000000000000");
                    if (!quote) return ctx.reply(`🤖 Could not get ${activeChain} swap quote.`);
                    outAmount = ethers.formatUnits(quote.toAmount, 6);
                }

                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `🔄 *Swap Preview (${activeChain.toUpperCase()})*\n` +
                    `📤 You pay: \`${amount} ${fromToken.toUpperCase()}\`\n` +
                    `📥 You get: \`${outAmount} ${toToken.toUpperCase()}\`\n\n` +
                    `_Confirm to execute_`,
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Confirm Swap', 'confirm_swap'),
                            Markup.button.callback('❌ Cancel', 'cancel_swap')
                        ]
                    ])
                );
            }

            case "send_token":
            case "send_sol": {
                const { amount, address } = intent.params;

                if (amount && address) {
                    await setSession(userId, { 
                        waitingForAddress: true, 
                        sendAmount: amount,
                        receiverAddress: address
                    });
                    
                    return ctx.replyWithMarkdown(
                        `🤖 *${intent.message}*\n\n` +
                        `🔄 *Transaction Review*\n` +
                        `📤 Sending: \`${amount} ${assetSymbol}\`\n` +
                        `📥 To: \`${address}\`\n` +
                        `🌐 Network: ${activeChain.toUpperCase()}\n\n` +
                        `_Click below to execute:_`,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('🚀 Execute Transaction', 'confirm_ai_send')],
                            [Markup.button.callback('❌ Cancel', 'cancel_swap')]
                        ])
                    );
                }

                if (address && !amount) {
                    await setSession(userId, { waitingForAmount: true, receiverAddress: address });
                    return ctx.replyWithMarkdown(
                        `🤖 I've got the address: \`${address}\`\n\n` +
                        `*How much ${assetSymbol}* do you want to send?\n\n` +
                        `_Type /cancel to abort_`
                    );
                }

                if (amount && !address) {
                    await setSession(userId, { waitingForAddress: true, sendAmount: amount });
                    return ctx.replyWithMarkdown(
                        `🤖 Okay, sending \`${amount} ${assetSymbol}\`.\n\n` +
                        `*What is the recipient address?*\n\n` +
                        `_Type /cancel to abort_`
                    );
                }

                await setSession(userId, { waitingForAmount: true });
                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `How much ${assetSymbol} do you want to send?\n\n` +
                    `_Type /cancel to abort_`
                );
            }

            case "launch_token": {
                if (activeChain !== "solana") {
                    return ctx.reply(`🤖 Token launching on ${activeChain.toUpperCase()} is coming soon!`);
                }
                await setSession(userId, { launchStep: "name" });
                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `🚀 *Token Launch Wizard*\n\n` +
                    `*Step 1/4* — Token Name\n\n` +
                    `What is your token called?\n\n` +
                    `_Type /cancel to abort_`
                );
            }

            case "help": {
                return ctx.replyWithMarkdown(
                    `🤖 *ArmEthSol AI Help*\n\n` +
                    `I am chain-aware! I currently support:\n` +
                    `• Balance check (${activeChain.toUpperCase()})\n` +
                    `• Multi-chain portfolio\n` +
                    `• Sending native tokens\n` +
                    `• Solana Swaps & Launching\n\n` +
                    `Just type \`/ai\` followed by what you want!`,
                    mainKeyboard(activeChain)
                );
            }

            default: {
                return ctx.replyWithMarkdown(
                    `🤖 I understood: _"${intent.message}"_\n\n` +
                    `But I'm not sure how to help with that on ${activeChain.toUpperCase()} yet.`,
                    mainKeyboard(activeChain)
                );
            }
        }
    } catch (error) {
        console.error("AI handler error:", error);
        return ctx.reply("🤖 Something went wrong. Please try again.", mainKeyboard());
    }
}
