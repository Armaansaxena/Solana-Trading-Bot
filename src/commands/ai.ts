import { bot, SESSION } from "../bot";
import { getUserKeypair, getBalance, prisma } from "../services/solana";
import { getQuote, TOKEN_MINTS, formatTokenAmount } from "../services/jupiter";
import { mainKeyboard } from "../keyboards";
import { Markup } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are SolBot AI, an intelligent Solana trading assistant inside a Telegram bot.

Your job is to understand what the user wants to do and respond with a JSON action.

Available actions:
- check_balance: Check SOL balance
- check_portfolio: Show full portfolio
- swap_tokens: Swap tokens (needs: fromToken, toToken, amount)
- get_price: Get token price (needs: token)
- send_sol: Send SOL (needs: amount, optional: address)
- launch_token: Launch a new token
- help: Show help
- unknown: Cannot understand the request

Supported tokens: SOL, USDC, USDT, BONK, JUP, WIF

ALWAYS respond with valid JSON only. No text, no explanation, just JSON.

Format:
{
  "action": "action_name",
  "params": {
    "fromToken": "SOL",
    "toToken": "USDC", 
    "amount": 1.5,
    "token": "SOL"
  },
  "message": "Human readable confirmation of what you understood"
}

Examples:
User: "swap 2 sol to usdc"
{"action":"swap_tokens","params":{"fromToken":"SOL","toToken":"USDC","amount":2},"message":"Swapping 2 SOL to USDC"}

User: "whats my balance"
{"action":"check_balance","params":{},"message":"Checking your SOL balance"}

User: "buy $50 worth of bonk"
{"action":"swap_tokens","params":{"fromToken":"USDC","toToken":"BONK","amount":50},"message":"Buying $50 worth of BONK using USDC"}

User: "how much is sol worth"
{"action":"get_price","params":{"token":"SOL"},"message":"Getting current SOL price"}

User: "send 0.5 sol"
{"action":"send_sol","params":{"amount":0.5},"message":"Initiating send of 0.5 SOL"}

User: "launch a token"
{"action":"launch_token","params":{},"message":"Starting token launch wizard"}

User: "portfolio"
{"action":"check_portfolio","params":{},"message":"Loading your portfolio"}`;

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

        if (!text) {
            return ctx.replyWithMarkdown(
                `🤖 *SolBot AI*\n\n` +
                `Talk to your wallet in plain English!\n\n` +
                `*Examples:*\n` +
                `• \`/ai swap 2 SOL to USDC\`\n` +
                `• \`/ai what's my balance\`\n` +
                `• \`/ai buy $50 of BONK\`\n` +
                `• \`/ai show my portfolio\`\n` +
                `• \`/ai get SOL price\`\n` +
                `• \`/ai launch a token\`\n\n` +
                `_Or just type naturally after /ai_`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
                ])
            );
        }

        await handleAIMessage(ctx, ctx.from.id, text);
    });

    bot.action('ai_menu', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `🤖 *SolBot AI Assistant*\n\n` +
            `Talk to your wallet in plain English!\n\n` +
            `*Try these:*\n` +
            `• \`/ai swap 1 SOL to USDC\`\n` +
            `• \`/ai check my balance\`\n` +
            `• \`/ai buy $20 of BONK\`\n` +
            `• \`/ai show portfolio\`\n` +
            `• \`/ai SOL price\`\n\n` +
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
            where: { telegramId: BigInt(userId) }
        });

        if (!user) {
            return ctx.replyWithMarkdown(
                "❌ No wallet found. Generate one first with /start",
                mainKeyboard()
            );
        }

        await ctx.replyWithMarkdown(`🤖 _Thinking..._`);

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
                const balance = await getBalance(new PublicKey(user.publicKey));
                let usdValue = 0;
                try {
                    const quote = await getQuote("SOL", "USDC", balance);
                    if (quote) usdValue = parseInt(quote.outAmount) / 1e6;
                } catch (e) {}

                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `💰 Balance: ${balance.toFixed(4)} SOL\n` +
                    `💵 Value: $${usdValue.toFixed(2)} USD`,
                    mainKeyboard()
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
                if (!token || !TOKEN_MINTS[token]) {
                    return ctx.reply(`🤖 Unknown token: ${token}`);
                }

                const quote = await getQuote(token, "USDC", 1);
                if (!quote) return ctx.reply("🤖 Could not fetch price right now.");

                const price = formatTokenAmount(quote.outAmount, "USDC");
                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `💰 1 ${token} = $${price} USDC`,
                    mainKeyboard()
                );
            }

            case "swap_tokens": {
                const { fromToken, toToken, amount } = intent.params;
                if (!fromToken || !toToken || !amount) {
                    return ctx.reply("🤖 Please specify: from token, to token, and amount.");
                }

                // Trigger swap flow
                SESSION[userId] = {
                    waitingForSwapAmount: true,
                    swapFromToken: fromToken.toUpperCase(),
                    swapToToken: toToken.toUpperCase(),
                    sendAmount: amount
                };

                const quote = await getQuote(fromToken, toToken, amount);
                if (!quote) return ctx.reply("🤖 Could not get swap quote.");

                const outAmount = formatTokenAmount(quote.outAmount, toToken);

                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `🔄 *Swap Preview*\n` +
                    `📤 You pay: \`${amount} ${fromToken.toUpperCase()}\`\n` +
                    `📥 You get: \`${outAmount} ${toToken.toUpperCase()}\`\n` +
                    `📊 Price impact: ${parseFloat(quote.priceImpactPct).toFixed(3)}%\n\n` +
                    `_Confirm to execute_`,
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Confirm Swap', 'confirm_swap'),
                            Markup.button.callback('❌ Cancel', 'cancel_swap')
                        ]
                    ])
                );
            }

            case "send_sol": {
                const { amount } = intent.params;
                SESSION[userId] = { waitingForAmount: true };

                if (amount) {
                    const balance = await getBalance(new PublicKey(user.publicKey));
                    SESSION[userId] = { waitingForAddress: true, sendAmount: amount };
                    return ctx.replyWithMarkdown(
                        `🤖 *${intent.message}*\n\n` +
                        `💰 Sending: ${amount} SOL\n\n` +
                        `📨 Enter the *recipient address*:\n\n` +
                        `_Type /cancel to abort_`
                    );
                }

                return ctx.replyWithMarkdown(
                    `🤖 *${intent.message}*\n\n` +
                    `How much SOL do you want to send?\n\n` +
                    `_Type /cancel to abort_`
                );
            }

            case "launch_token": {
                SESSION[userId] = { launchStep: "name" };
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
                    `🤖 *SolBot AI Help*\n\n` +
                    `I can help you:\n` +
                    `• Check balance & portfolio\n` +
                    `• Swap tokens\n` +
                    `• Get token prices\n` +
                    `• Send SOL\n` +
                    `• Launch tokens\n\n` +
                    `Just type \`/ai\` followed by what you want!`,
                    mainKeyboard()
                );
            }

            default: {
                return ctx.replyWithMarkdown(
                    `🤖 I understood: _"${intent.message}"_\n\n` +
                    `But I'm not sure how to help with that yet.\n\n` +
                    `Try: swap, balance, portfolio, price, send, or launch`,
                    mainKeyboard()
                );
            }
        }
    } catch (error) {
        console.error("AI handler error:", error);
        return ctx.reply("🤖 Something went wrong. Please try again.", mainKeyboard());
    }
}