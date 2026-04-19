import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { Telegraf } from "telegraf";
import { getSolanaConnection } from "./services/rpc";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not defined");

export const bot = new Telegraf(BOT_TOKEN);

// Export helper to get live connection
export async function getConnection() {
    return await getSolanaConnection();
}
