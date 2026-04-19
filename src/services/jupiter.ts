import { connection } from "./rpc";
import { Keypair, VersionedTransaction, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

// Raydium API Endpoints
const RAYDIUM_QUOTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";
const RAYDIUM_SWAP_API = "https://transaction-v1.raydium.io/transaction/swap-base-in";

const isLocal = process.env.SOLANA_MAINNET_RPC?.includes("127.0.0.1") || process.env.SOLANA_MAINNET_RPC?.includes("localhost");

export const TOKEN_MINTS: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
};

export interface QuoteResult {
    outAmount: string;
    priceImpactPct: string;
    raw: any;
    isSimulated?: boolean;
}

export async function getQuote(
    fromSymbol: string,
    toSymbol: string,
    amount: number
): Promise<QuoteResult | null> {
    try {
        if (isLocal) {
            console.log("🛠️ Using Local Simulation Quote");
            return {
                outAmount: (amount * 150 * 1e6).toString(), // Mock $150 SOL price
                priceImpactPct: "0.1",
                raw: { simulated: true, amount },
                isSimulated: true
            };
        }

        const fromMint = TOKEN_MINTS[fromSymbol.toUpperCase()] || fromSymbol;
        const toMint = TOKEN_MINTS[toSymbol.toUpperCase()] || toSymbol;
        
        const decimals = fromSymbol.toUpperCase() === "SOL" ? 9 : 6;
        const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

        const params = new URLSearchParams({
            inputMint: fromMint,
            outputMint: toMint,
            amount: amountInSmallestUnit.toString(),
            slippageBps: "100",
            txVersion: "V0"
        });

        const response = await fetch(`${RAYDIUM_QUOTE_API}?${params}`);
        const data = await response.json() as any;

        if (!data.success) return null;

        return {
            outAmount: data.data.outputAmount,
            priceImpactPct: data.data.priceImpactPct?.toString() || "0",
            raw: data.data
        };
    } catch (error) {
        console.error("Raydium getQuote error:", error);
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
        if (!quote) return null;

        if (isLocal || quote.isSimulated) {
            console.log("🛠️ Executing Simulated Swap (Localnet)");
            // Send SOL to treasury to simulate a trade
            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(process.env.TREASURY_SOL_ADDRESS!),
                    lamports: 1000, 
                })
            );
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = keypair.publicKey;
            tx.sign(keypair);
            
            return await connection.sendRawTransaction(tx.serialize());
        }

        // --- Real Mainnet Execution ---
        const swapResponse = await fetch(RAYDIUM_SWAP_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                computeUnitPriceMicroLamports: "100000",
                swapResponse: quote.raw,
                txVersion: "V0",
                wallet: keypair.publicKey.toBase58(),
                wrapSol: fromSymbol.toUpperCase() === "SOL",
                unwrapSol: toSymbol.toUpperCase() === "SOL",
            })
        });

        const swapData = await swapResponse.json() as any;
        if (!swapData.success) return null;

        const txBuffer = Buffer.from(swapData.data[0].transaction, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        transaction.message.recentBlockhash = blockhash;

        transaction.sign([keypair]);
        const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });

        // Polling confirmation
        let confirmed = false;
        const start = Date.now();
        while (!confirmed && Date.now() - start < 30000) {
            const status = await connection.getSignatureStatus(signature);
            if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
                confirmed = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        return signature;

    } catch (error) {
        console.error("executeSwap error:", error);
        return null;
    }
}

export function formatTokenAmount(amount: string, symbol: string): string {
    const decimals = symbol.toUpperCase() === "SOL" ? 9 : 6;
    return (parseInt(amount) / Math.pow(10, decimals)).toFixed(4);
}
