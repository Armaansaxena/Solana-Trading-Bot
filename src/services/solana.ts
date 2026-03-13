import { Keypair, PublicKey } from "@solana/web3.js";
import { connection } from "../bot";
import { decrypt } from "../utils/crypto";
import { PrismaClient } from "@prisma/client";
import bs58 from "bs58";

const prisma = new PrismaClient();
export { prisma };

export async function getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9;
}

export async function getUserKeypair(telegramId: number): Promise<Keypair | null> {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
    });
    if (!user) return null;

    const decryptedKey = decrypt(user.iv, user.encryptedKey);
    const secretKeyArray = bs58.decode(decryptedKey);
    return Keypair.fromSecretKey(secretKeyArray);
}

export async function getUserPublicKey(telegramId: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
    });
    return user?.publicKey || null;
}