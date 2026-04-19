import { Redis } from "@upstash/redis";
import type { SessionData } from "../types/index";
import * as dotenv from "dotenv";
dotenv.config({ override: true });

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Session TTL — 1 hour
const SESSION_TTL = 3600;

export async function getSession(userId: number): Promise<SessionData> {
    try {
        const data = await redis.get<SessionData>(`session:${userId}`);
        return data || {};
    } catch (error) {
        console.error("Redis get error:", error);
        return {};
    }
}

export async function setSession(userId: number, data: SessionData): Promise<void> {
    try {
        await redis.set(`session:${userId}`, data, { ex: SESSION_TTL });
    } catch (error) {
        console.error("Redis set error:", error);
    }
}

export async function clearSession(userId: number): Promise<void> {
    try {
        await redis.del(`session:${userId}`);
    } catch (error) {
        console.error("Redis del error:", error);
    }
}

// --- DYNAMIC FEE MANAGEMENT ---
export async function getFeePercentage(): Promise<number> {
    try {
        const feeStr = await redis.get<string>("global:fee_percentage");
        if (feeStr !== null) {
            return parseFloat(feeStr);
        }
    } catch (e) {}
    // Default fallback is from ENV or 0.005 (0.5%)
    return parseFloat(process.env.FEE_PERCENTAGE || "0.005");
}

export async function setFeePercentage(fee: number): Promise<void> {
    try {
        await redis.set("global:fee_percentage", fee.toString());
        console.log(`💰 Global fee percentage updated to: ${fee * 100}%`);
    } catch (error) {
        console.error("Redis set fee error:", error);
    }
}