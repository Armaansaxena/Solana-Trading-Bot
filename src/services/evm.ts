import { ethers } from "ethers";
import { prisma } from "./db";
import { encrypt, decrypt } from "../utils/crypto";
import { getEVMProvider } from "./rpc";

export async function createEVMWallet(userId: number, name: string = "Main EVM Wallet") {
    const wallet = ethers.Wallet.createRandom();
    const { iv, content } = encrypt(wallet.privateKey);

    const dbWallet = await prisma.wallet.create({
        data: {
            userId: userId,
            publicKey: wallet.address,
            encryptedKey: content,
            iv: iv,
            name: name,
            chain: "evm"
        }
    });

    return dbWallet;
}

export async function getEVMKeypair(userId: number, chain: "ethereum" | "base" = "ethereum") {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { activeWallet: true }
    });

    if (!user || !user.activeWallet || user.activeWallet.chain !== "evm") return null;

    const privateKey = decrypt(user.activeWallet.iv, user.activeWallet.encryptedKey);
    return new ethers.Wallet(privateKey, getEVMProvider(chain));
}

export async function getEVMBalance(address: string, chain: "ethereum" | "base") {
    try {
        // Fail-safe: Ensure address is a valid EVM address format
        if (!address || !address.startsWith("0x") || address.length !== 42) {
            console.warn(`⚠️ getEVMBalance: Invalid EVM address provided: ${address}`);
            return 0;
        }

        const provider = getEVMProvider(chain);
        const balance = await provider.getBalance(address);
        return parseFloat(ethers.formatEther(balance));
    } catch (error) {
        console.error(`Error fetching ${chain} balance for ${address}:`, error);
        return 0;
    }
}

export async function getActiveEVMWallet(userId: number) {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { activeWallet: true }
    });
    
    if (user?.activeWallet?.chain === "evm") {
        return user.activeWallet;
    }
    
    return null;
}
