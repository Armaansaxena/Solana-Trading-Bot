import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { Telegraf } from "telegraf";
import { connection } from "./services/rpc";
import type { SessionData } from "./types/index";

console.log("🔑 BOT_TOKEN exists:", !!process.env.BOT_TOKEN);
console.log("🔑 BOT_TOKEN value:", process.env.BOT_TOKEN?.slice(0, 10) + "...");
console.log("🔑 JUPITER_API_KEY exists:", !!process.env.JUPITER_API_KEY);
console.log("🔑 JUPITER_API_KEY value:", process.env.JUPITER_API_KEY?.slice(0, 8) + "...");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not defined");

export const bot = new Telegraf(BOT_TOKEN);

export { connection };