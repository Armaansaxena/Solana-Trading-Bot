import { prisma } from "../src/services/db";

async function fixActiveWallets() {
    console.log("🛠️ Starting database sync...");
    const users = await prisma.user.findMany({
        include: { wallets: true }
    });

    for (const user of users) {
        const chain = user.activeChain || "solana";
        const chainType = (chain === "ethereum" || chain === "base") ? "evm" : "solana";
        
        const correctWallet = user.wallets.find(w => w.chain === chainType);
        
        if (correctWallet && user.activeWalletId !== correctWallet.id) {
            console.log(`✅ Syncing User ${user.telegramId}: Switching activeWalletId to ${correctWallet.name} (${chain})`);
            await prisma.user.update({
                where: { id: user.id },
                data: { activeWalletId: correctWallet.id }
            });
        }
    }
    console.log("🏁 Database sync complete.");
}

fixActiveWallets()
    .catch(err => console.error(err))
    .finally(() => process.exit());
