import { getEVMProvider, getSolanaConnection } from "../src/services/rpc";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

async function testAll() {
    console.log("🚀 Starting Full System Test...");
    console.log("-------------------------------");

    // 1. Test Solana
    console.log("\n🟣 Testing SOLANA...");
    try {
        const conn = getSolanaConnection();
        const slot = await conn.getSlot();
        console.log(`✅ Solana Success! Current Slot: ${slot}`);
        const version = await conn.getVersion();
        console.log(`ℹ️ Node Version: ${version["solana-core"]}`);
    } catch (e: any) {
        console.error(`❌ Solana Failed: ${e.message}`);
    }

    // 2. Test EVM
    const evmChains: ("ethereum" | "base")[] = ["ethereum", "base"];
    for (const chain of evmChains) {
        console.log(`\n🌐 Testing ${chain.toUpperCase()}...`);
        try {
            const provider = getEVMProvider(chain);
            const block = await provider.getBlockNumber();
            console.log(`✅ ${chain} Success! Current Block: ${block}`);
            
            const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
            const balance = await provider.getBalance(vitalik);
            console.log(`💰 Vitalik Balance: ${ethers.formatEther(balance)} ETH`);
        } catch (e: any) {
            console.error(`❌ ${chain} Failed: ${e.message}`);
        }
    }

    console.log("\n-------------------------------");
    console.log("🏁 Test Cycle Complete.");
    process.exit(0);
}

testAll();
