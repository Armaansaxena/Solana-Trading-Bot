import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper to save user data
// db.ts
export type UserWalletData = {
    publicKey: string;
    encryptedKey: string;
    iv: string;
};

export async function saveUserWallet(telegramId: number, data: UserWalletData) {
    // Upstash's hset can take the object directly if it matches the Record type
    await redis.hset(`user:${telegramId}`, data as any); 
}

// Helper to get user data
export async function getUserWallet(telegramId: number) {
  return await redis.hgetall(`user:${telegramId}`);
}