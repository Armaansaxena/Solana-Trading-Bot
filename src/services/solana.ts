import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { Keypair, PublicKey } from "@solana/web3.js";
import { getSolanaConnection } from "./rpc";
import { decrypt, encrypt } from "../utils/crypto";
import { prisma } from "./db";
import bs58 from "bs58";

export async function createSolanaWallet(userId: number, name: string = "Main Solana Wallet") {
    const kp = Keypair.generate();
    const { iv, content } = encrypt(bs58.encode(kp.secretKey));

    const dbWallet = await prisma.wallet.create({
        data: {
            userId: userId,
            publicKey: kp.publicKey.toBase58(),
            encryptedKey: content,
            iv: iv,
            name: name,
            chain: "solana"
        }
    });

    return dbWallet;
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
    const conn = await getSolanaConnection();
    const balance = await conn.getBalance(publicKey);
    return balance / 1e9;
}

export async function getUserKeypair(telegramId: number): Promise<Keypair | null> {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { activeWallet: true }
    });
    
    if (!user) return null;

    // Use active wallet if exists, otherwise fallback to legacy columns
    const wallet = user.activeWallet;
    const iv = wallet ? wallet.iv : user.iv;
    const encryptedKey = wallet ? wallet.encryptedKey : user.encryptedKey;

    if (!iv || !encryptedKey) return null;

    const decryptedKey = decrypt(iv, encryptedKey);
    const secretKeyArray = bs58.decode(decryptedKey);
    return Keypair.fromSecretKey(secretKeyArray);
}

export async function getUserPublicKey(telegramId: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { activeWallet: true }
    });
    
    if (!user) return null;
    return user.activeWallet?.publicKey || user.publicKey || null;
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