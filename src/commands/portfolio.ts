import { bot } from "../bot";
import { getBalance } from "../services/solana";
import { prisma } from "../services/db";
import { getQuote, TOKEN_MINTS } from "../services/jupiter";
import { getEVMBalance } from "../services/evm";
import { mainKeyboard } from "../keyboards";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../services/rpc";
import { Markup } from "telegraf";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

interface TokenBalance {
    symbol: string;
    mint: string;
    balance: number;
    usdValue: number;
}

async function getSolanaTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
        const publicKey = new PublicKey(walletAddress);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            { programId: TOKEN_PROGRAM_ID }
        );

        const balances: TokenBalance[] = [];
        const mintToSymbol: Record<string, string> = {};
        for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
            mintToSymbol[mint] = symbol;
        }

        for (const account of tokenAccounts.value) {
            const parsedInfo = account.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const amount = parsedInfo.tokenAmount.uiAmount;

            if (amount > 0) {
                const symbol = mintToSymbol[mint] || `${mint.slice(0, 4)}...${mint.slice(-4)}`;
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
                } catch (e) {}
                balances.push({ symbol, mint, balance: amount, usdValue });
            }
        }
        return balances;
    } catch (error) {
        return [];
    }
}

export function registerPortfolioCommands() {
    bot.action('portfolio', async (ctx) => {
        const userId = ctx.from!.id;
        await ctx.answerCbQuery("Loading multi-chain portfolio...");
        await showPortfolio(ctx, userId);
    });

    bot.command('portfolio', async (ctx) => {
        const userId = ctx.from.id;
        await showPortfolio(ctx, userId);
    });

    async function showPortfolio(ctx: any, userId: number) {
        try {
            const user = await prisma.user.findUnique({
                where: { telegramId: BigInt(userId) },
                include: { wallets: true }
            });

            if (!user || user.wallets.length === 0) {
                return ctx.replyWithMarkdown("❌ No wallets found. Generate one first!", mainKeyboard());
            }

            await ctx.replyWithMarkdown("⏳ *Fetching all wallet balances...*");

            let totalUsd = 0;
            let message = `📊 *Multi-Chain Portfolio*\n\n`;

            const solWallets = user.wallets.filter(w => w.chain === "solana");
            const evmWallets = user.wallets.filter(w => w.chain === "evm");

            // --- SOLANA SECTION ---
            if (solWallets.length > 0) {
                message += `🟣 *Solana Network*\n`;
                for (const w of solWallets) {
                    const balance = await getBalance(new PublicKey(w.publicKey));
                    let usd = 0;
                    try {
                        const quote = await getQuote("SOL", "USDC", balance);
                        if (quote) usd = parseInt(quote.outAmount) / 1e6;
                    } catch (e) {}
                    
                    totalUsd += usd;
                    message += `   🆔 *${w.name}*\n`;
                    message += `   💰 ${balance.toFixed(4)} SOL ($${usd.toFixed(2)})\n`;
                    
                    // Optional: Get token balances for this specific wallet
                    const tokens = await getSolanaTokenBalances(w.publicKey);
                    for (const t of tokens) {
                        message += `   • ${t.symbol}: ${t.balance.toFixed(2)} ($${t.usdValue.toFixed(2)})\n`;
                        totalUsd += t.usdValue;
                    }
                    message += `\n`;
                }
            }

            // --- ETHEREUM & BASE SECTION ---
            if (evmWallets.length > 0) {
                // ETHEREUM
                message += `🔹 *Ethereum Network*\n`;
                for (const w of evmWallets) {
                    const balance = await getEVMBalance(w.publicKey, "ethereum");
                    const usd = balance * 2500; // Mock price
                    totalUsd += usd;
                    message += `   🆔 *${w.name}*\n`;
                    message += `   💰 ${balance.toFixed(4)} ETH ($${usd.toFixed(2)})\n\n`;
                }

                // BASE
                message += `🔵 *Base Network*\n`;
                for (const w of evmWallets) {
                    const balance = await getEVMBalance(w.publicKey, "base");
                    const usd = balance * 2500; // Mock price
                    totalUsd += usd;
                    message += `   🆔 *${w.name}*\n`;
                    message += `   💰 ${balance.toFixed(4)} ETH ($${usd.toFixed(2)})\n\n`;
                }
            }

            message += `━━━━━━━━━━━━━━━\n`;
            message += `💰 *Total Estimated Value: $${totalUsd.toFixed(2)} USD*\n`;
            message += `━━━━━━━━━━━━━━━`;

            return ctx.replyWithMarkdown(
                message,
                mainKeyboard(user.activeChain)
            );
        } catch (error) {
            console.error("Portfolio error:", error);
            return ctx.reply("❌ Error loading portfolio.", mainKeyboard());
        }
    }
}
