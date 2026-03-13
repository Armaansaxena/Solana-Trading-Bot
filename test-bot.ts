// test-bot.ts
import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start((ctx) => {
    console.log("✅ Got /start from:", ctx.from.id);
    ctx.reply("Hello! Bot is working!");
});

bot.launch().then(() => {
    console.log("✅ Bot polling started");
}).catch((err) => {
    console.error("❌ Launch error:", err);
});