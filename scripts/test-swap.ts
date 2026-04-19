import { Keypair } from "@solana/web3.js";
import { getQuote, executeSwap, formatTokenAmount } from "../src/services/jupiter";
import { prisma } from "../src/services/db";
import { decrypt } from "../src/utils/crypto";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

async function testLocalSwap() {
    console.log("🔄 Starting Local Swap Test...");

    // 1. Get a test user (yours)
    const user = await prisma.user.findFirst({
        where: { telegramId: BigInt(1531188039) }, // Your TG ID
        include: { wallets: true }
    });

    if (!user) {
        console.error("❌ User not found in database.");
        return;
    }

    const solWallet = user.wallets.find(w => w.chain === "solana");
    if (!solWallet) {
        console.error("❌ Solana wallet not found.");
        return;
    }

    // 2. Decrypt Keypair
    const privateKey = decrypt(solWallet.iv, solWallet.encryptedKey);
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

    console.log(`📍 Testing with wallet: ${keypair.publicKey.toBase58()}`);

    // 3. Get Quote
    console.log("⏳ Fetching quote for 0.1 SOL -> USDC...");
    const quote = await getQuote("SOL", "USDC", 0.1);
    
    if (!quote) {
        console.error("❌ Failed to get quote.");
        return;
    }
    
    console.log(`✅ Quote received: ~${formatTokenAmount(quote.outAmount, "USDC")} USDC`);

    // 4. Execute
    console.log("🚀 Executing swap on Surfpool...");
    const signature = await executeSwap(keypair, "SOL", "USDC", 0.1);

    if (signature) {
        console.log(`🎯 Swap Successful! Signature: ${signature}`);
    } else {
        console.error("❌ Swap failed.");
    }

    process.exit();
}

testLocalSwap().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
