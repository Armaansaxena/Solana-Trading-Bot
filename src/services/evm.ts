import { ethers } from "ethers";
import { prisma } from "./db";
import { encrypt, decrypt } from "../utils/crypto";
import { getEVMProvider } from "./rpc";

export async function createEVMWallet(userId: number, name: string = "Main EVM Wallet") {
    const wallet = ethers.Wallet.createRandom();
    const encrypted = encrypt(wallet.privateKey);

    const newWallet = await prisma.wallet.create({
        data: {
            userId,
            publicKey: wallet.address,
            encryptedKey: encrypted.content,
            iv: encrypted.iv,
            name,
            chain: "evm"
        }
    });

    return newWallet;
}

export async function getEVMKeypair(userId: number, chain: "ethereum" | "base" = "ethereum") {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { wallets: true }
    });

    const wallet = user?.wallets.find(w => w.chain === "evm");
    if (!wallet) return null;

    const privateKey = decrypt(wallet.iv, wallet.encryptedKey);
    const provider = await getEVMProvider(chain);
    return new ethers.Wallet(privateKey, provider);
}

export async function getEVMBalance(address: string, chain: "ethereum" | "base") {
    try {
        const provider = await getEVMProvider(chain);
        const balance = await provider.getBalance(address);
        return parseFloat(ethers.formatEther(balance));
    } catch (error) {
        console.error("EVM Balance error:", error);
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
