import { bot } from "../bot";
import { getUserKeypair, getBalance, prisma } from "../services/solana";
import { getQuote, TOKEN_MINTS, formatTokenAmount } from "../services/jupiter";
import { mainKeyboard, postWalletKeyboard } from "../keyboards";
import { PublicKey, Connection } from "@solana/web3.js";
import { connection } from "../bot";
import { Markup } from "telegraf";


// Token program ID
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

interface TokenBalance {
    symbol: string;
    mint: string;
    balance: number;
    usdValue: number;
}

async function getTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
        const publicKey = new PublicKey(walletAddress);
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            { programId: TOKEN_PROGRAM_ID }
        );

        const balances: TokenBalance[] = [];

        // Build reverse lookup: mint → symbol
        const mintToSymbol: Record<string, string> = {};
        for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
            mintToSymbol[mint] = symbol;
        }

        for (const account of tokenAccounts.value) {
            const parsedInfo = account.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const amount = parsedInfo.tokenAmount.uiAmount;

            // Show ALL tokens with non-zero balance
            if (amount > 0) {
                // Use known symbol or shorten the mint address
                const symbol = mintToSymbol[mint] || `${mint.slice(0, 4)}...${mint.slice(-4)}`;

                // Only get USD value for known tokens
                let usdValue = 0;
                try {
                    if (mintToSymbol[mint]) {
                        if (symbol === "USDC" || symbol === "USDT") {
                            usdValue = amount;
                        } else {
                            const quote = await getQuote(symbol, "USDC", amount);
                            if (quote) {
                                usdValue = parseInt(quote.outAmount) / 1e6;
                            }
                        }
                    }
                } catch (e) {
                    usdValue = 0;
                }

                balances.push({ symbol, mint, balance: amount, usdValue });
            }
        }

        return balances;
    } catch (error) {
        console.error("Token balance error:", error);
        return [];
    }
}

export function registerPortfolioCommands() {

    bot.action('portfolio', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery("Loading portfolio...");
        await showPortfolio(ctx, userId);
    });

    bot.command('portfolio', async (ctx) => {
        const userId = ctx.from.id;
        await showPortfolio(ctx, userId);
    });

    async function showPortfolio(ctx: any, userId: number) {
        try {
            const user = await prisma.user.findUnique({
                where: { telegramId: BigInt(userId) }
            });

            if (!user) {
                return ctx.replyWithMarkdown(
                    "❌ No wallet found. Generate one first.",
                    mainKeyboard()
                );
            }

            await ctx.replyWithMarkdown("⏳ *Loading portfolio...*\n\n_Fetching balances & prices_");

            // Get SOL balance
            const solBalance = await getBalance(new PublicKey(user.publicKey));

            // Get SOL USD value
            let solUsdValue = 0;
            try {
                const solQuote = await getQuote("SOL", "USDC", solBalance);
                if (solQuote) {
                    solUsdValue = parseInt(solQuote.outAmount) / 1e6;
                }
            } catch (e) {}

            // Get token balances
            const tokenBalances = await getTokenBalances(user.publicKey);

            // Calculate total USD value
            const totalUsd = solUsdValue + tokenBalances.reduce((sum, t) => sum + t.usdValue, 0);

            // Build portfolio message
            let message = `📊 *Portfolio*\n\n`;
            message += `📍 \`${user.publicKey.slice(0, 8)}...${user.publicKey.slice(-8)}\`\n\n`;
            message += `💼 *Total Value: $${totalUsd.toFixed(2)} USD*\n\n`;
            message += `━━━━━━━━━━━━━━━\n\n`;

            // SOL row
            message += `⚡ *SOL*\n`;
            message += `   Balance: ${solBalance.toFixed(4)} SOL\n`;
            message += `   Value: $${solUsdValue.toFixed(2)}\n\n`;

            // Token rows
            if (tokenBalances.length > 0) {
                for (const token of tokenBalances) {
                    message += `🪙 *${token.symbol}*\n`;
                    message += `   Balance: ${token.balance.toFixed(4)}\n`;
                    message += `   Value: $${token.usdValue.toFixed(2)}\n\n`;
                }
            } else {
                message += `_No other tokens found_\n\n`;
            }

            message += `━━━━━━━━━━━━━━━\n`;
            message += `🔄 _Prices via Raydium_`;

            return ctx.replyWithMarkdown(
                message,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🔄 Refresh', 'portfolio'),
                        Markup.button.callback('💸 Send SOL', 'send_sol')
                    ],
                    [
                        Markup.button.callback('🔄 Swap Tokens', 'swap_menu'),
                        Markup.button.callback('🏠 Menu', 'main_menu')
                    ]
                ])
            );
        } catch (error) {
            console.error("Portfolio error:", error);
            return ctx.reply("❌ Error loading portfolio. Please try again.", mainKeyboard());
        }
    }
}