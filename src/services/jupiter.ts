import { connection } from "../bot";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

const RAYDIUM_QUOTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";
const RAYDIUM_SWAP_API = "https://transaction-v1.raydium.io/transaction/swap-base-in";

export const TOKEN_MINTS: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
};

export interface QuoteResult {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    otherAmountThreshold: string;
    routePlan: any[];
    raw: any;
}

export function getTokenMint(symbol: string): string | null {
    return TOKEN_MINTS[symbol.toUpperCase()] || null;
}

export async function getQuote(
    fromSymbol: string,
    toSymbol: string,
    amount: number
): Promise<QuoteResult | null> {
    try {
        const fromMint = getTokenMint(fromSymbol);
        const toMint = getTokenMint(toSymbol);
        if (!fromMint || !toMint) return null;

        const decimals = fromSymbol.toUpperCase() === "SOL" ? 9 : 6;
        const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

        const params = new URLSearchParams({
            inputMint: fromMint,
            outputMint: toMint,
            amount: amountInSmallestUnit.toString(),
            slippageBps: "50",
            txVersion: "V0"
        });

        const response = await fetch(`${RAYDIUM_QUOTE_API}?${params}`);
        const data = await response.json() as any;

        console.log("Quote response:", JSON.stringify(data).slice(0, 200));

        if (!data.success) {
            console.error("Quote failed:", data);
            return null;
        }

        const quote: QuoteResult = {
            inputMint: data.data.inputMint,
            outputMint: data.data.outputMint,
            inAmount: data.data.inputAmount,
            outAmount: data.data.outputAmount,
            priceImpactPct: data.data.priceImpactPct?.toString() || "0",
            otherAmountThreshold: data.data.otherAmountThreshold,
            routePlan: data.data.routePlan,
            raw: data, // full response
        };

        return quote;
    } catch (error) {
        console.error("Quote error:", error);
        return null;
    }
}

export async function executeSwap(
    keypair: Keypair,
    fromSymbol: string,
    toSymbol: string,
    amount: number
): Promise<string | null> {
    try {
        const quote = await getQuote(fromSymbol, toSymbol, amount);
        if (!quote) throw new Error("Failed to get quote");

        const swapResponse = await fetch(RAYDIUM_SWAP_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                computeUnitPriceMicroLamports: "100000",
                swapResponse: quote.raw,
                txVersion: "V0",
                wallet: keypair.publicKey.toBase58(),
                wrapSol: fromSymbol.toUpperCase() === "SOL",
                unwrapSol: toSymbol.toUpperCase() === "SOL",
            }),
        });

        const swapData = await swapResponse.json() as any;
        console.log("Swap response:", JSON.stringify(swapData).slice(0, 300));

        if (!swapData.success) {
            console.error("Swap failed:", swapData);
            return null;
        }

        const txBuffer = Buffer.from(swapData.data[0].transaction, "base64");

        // Always use VersionedTransaction for Raydium V0
        const transaction = VersionedTransaction.deserialize(txBuffer);

        // Get fresh blockhash before signing
        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.message.recentBlockhash = latestBlockhash.blockhash;
        transaction.sign([keypair]);

        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false, maxRetries: 3 }
        );

        await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");

        return signature;
    } catch (error) {
        console.error("Swap execution error:", error);
        return null;
    }
}

export function formatTokenAmount(amount: string, symbol: string): string {
    const decimals = symbol.toUpperCase() === "SOL" ? 9 : 6;
    const value = parseInt(amount) / Math.pow(10, decimals);
    return value.toFixed(4);
}