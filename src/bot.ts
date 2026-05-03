import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { Telegraf } from "telegraf";
import { getSolanaConnection } from "./services/rpc";

import http from 'http';

// Dummy server for Render health checks
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(port);

console.log(`Health check server listening on port ${port}`);

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not defined");

export const bot = new Telegraf(BOT_TOKEN);

// Export helper to get live connection
export async function getConnection() {
    return await getSolanaConnection();
}
