import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { Keypair, PublicKey } from "@solana/web3.js";
import { connection } from "../bot";
import { decrypt } from "../utils/crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bs58 from "bs58";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
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

export async function saveTransaction(
    telegramId: number,
    type: string,
    amount: number,
    signature: string,
    status: string,
    fromToken?: string,
    toToken?: string
) {
    try {
        await prisma.transaction.create({
            data: {
                telegramId: BigInt(telegramId),
                type,
                amount,
                signature,
                status,
                fromToken,
                toToken,
            }
        });
    } catch (error) {
        console.error("Save transaction error:", error);
    }
}