import { prisma } from "../src/services/db";
import { getEVMBalance } from "../src/services/evm";
import { getBalance } from "../src/services/solana";
import { PublicKey } from "@solana/web3.js";

async function checkAllBalances() {
    console.log("🔍 Checking all database wallets...");
    const users = await prisma.user.findMany({
        include: { wallets: true }
    });

    for (const user of users) {
        console.log(`\n👤 User: ${user.telegramId} (Active Chain: ${user.activeChain})`);
        for (const w of user.wallets) {
            console.log(`  📍 Wallet: ${w.name} (${w.chain})`);
            console.log(`     Address: ${w.publicKey}`);
            
            if (w.chain === "solana") {
                const bal = await getBalance(new PublicKey(w.publicKey));
                console.log(`     💰 SOL Balance: ${bal} SOL`);
            } else {
                const ethBal = await getEVMBalance(w.publicKey, "ethereum");
                const baseBal = await getEVMBalance(w.publicKey, "base");
                console.log(`     💰 ETH Balance (Eth): ${ethBal} ETH`);
                console.log(`     💰 ETH Balance (Base): ${baseBal} ETH`);
            }
        }
    }
    process.exit();
}

checkAllBalances().catch(err => console.error(err));
