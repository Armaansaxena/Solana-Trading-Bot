import { bot, SESSION, connection } from "../bot";
import { mainKeyboard, postWalletKeyboard, dangerKeyboard } from "../keyboards";
import { getBalance, getUserKeypair, prisma } from "../services/solana";
import { encrypt } from "../utils/crypto";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Markup } from "telegraf";
import bs58 from "bs58";
import { saveTransaction } from "../services/solana";
import { getSession, setSession, clearSession } from "../services/redis";

export function registerWalletCommands() {
  bot.action("main_menu", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText("🏠 *Main Menu*\nChoose an action:", {
      parse_mode: "Markdown",
      ...mainKeyboard(),
    });
  });

  bot.action("generate_wallet", async (ctx) => {
    await ctx.answerCbQuery("Generating wallet...");
    const userId = ctx.from!.id;
    try {
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
      });
      if (existingUser) {
        const balance = await getBalance(new PublicKey(existingUser.publicKey));
        return ctx.replyWithMarkdown(
          `⚠️ *Wallet Already Exists!*\n\n` +
            `📍 *Public Key:*\n\`${existingUser.publicKey}\`\n\n` +
            `💰 *Balance:* ${balance.toFixed(4)} SOL\n\n` +
            `_Use the menu below to manage your assets._`,
          postWalletKeyboard(),
        );
      }
      const keypair = Keypair.generate();
      const secretKeyStr = bs58.encode(keypair.secretKey);
      const { iv, content } = encrypt(secretKeyStr);
      await prisma.user.create({
        data: {
          telegramId: BigInt(userId),
          publicKey: keypair.publicKey.toBase58(),
          encryptedKey: content,
          iv: iv,
        },
      });
      const balance = await getBalance(keypair.publicKey);
      return ctx.replyWithMarkdown(
        `✅ *Wallet Created & Secured!*\n\n` +
          `📍 *Public Key:*\n\`${keypair.publicKey.toBase58()}\`\n\n` +
          `💰 *Balance:* ${balance.toFixed(4)} SOL\n\n` +
          `🔐 _Private key encrypted with AES-256_\n\n` +
          `💡 Add SOL to your wallet to get started`,
        postWalletKeyboard(),
      );
    } catch (error) {
      console.error("Wallet generation error:", error);
      return ctx.reply("❌ Failed to create wallet. Please try again.");
    }
  });

  bot.action("show_public_key", async (ctx) => {
    const userId = ctx.from!.id;
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
      });
      if (!user) {
        await ctx.answerCbQuery("❌ No wallet found");
        return ctx.reply(
          "❌ No wallet found. Generate one first.",
          mainKeyboard(),
        );
      }
      await ctx.answerCbQuery();
      return ctx.replyWithMarkdown(
        `📍 *Your Public Key:*\n\`${user.publicKey}\`\n\n` +
          `_Share this address to receive SOL_`,
        postWalletKeyboard(),
      );
    } catch (error) {
      return ctx.reply("❌ Error retrieving public key.");
    }
  });

  bot.action("check_balance", async (ctx) => {
    const userId = ctx.from!.id;
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
      });
      if (!user) {
        await ctx.answerCbQuery("❌ No wallet found");
        return ctx.reply("❌ Generate a wallet first.", mainKeyboard());
      }
      await ctx.answerCbQuery("Checking balance...");
      const balance = await getBalance(new PublicKey(user.publicKey));
      return ctx.replyWithMarkdown(
        `💰 *Wallet Balance*\n\n` +
          `${balance.toFixed(4)} SOL\n\n` +
          `📍 Address:\n\`${user.publicKey}\`\n\n` +
          `💡 Add SOL to your wallet to continue`,
        postWalletKeyboard(),
      );
    } catch (error) {
      return ctx.reply("❌ Error checking balance.");
    }
  });

  bot.action("show_private_key", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      "⚠️ *WARNING: EXTREME DANGER*\n\n" +
        "Showing your private key is *extremely dangerous*!\n\n" +
        "Anyone with this key can *steal all your funds*.\n\n" +
        "Are you sure you want to continue?",
      dangerKeyboard(),
    );
  });

  bot.action("confirm_show_private", async (ctx) => {
    const userId = ctx.from!.id;
    try {
      const keypair = await getUserKeypair(userId);
      if (!keypair) {
        await ctx.answerCbQuery("❌ No wallet found");
        return ctx.reply("❌ Generate a wallet first.", mainKeyboard());
      }
      await ctx.answerCbQuery();
      const secretKey = bs58.encode(keypair.secretKey);
      const exportData =
        `SOLANA WALLET EXPORT\n====================\n\n` +
        `Public Key:\n${keypair.publicKey.toBase58()}\n\n` +
        `Private Key (NEVER share):\n${secretKey}\n\n` +
        `Exported: ${new Date().toLocaleString()}\n`;

      await ctx.replyWithDocument(
        {
          source: Buffer.from(exportData),
          filename: `wallet-${Date.now()}.txt`,
        },
        {
          caption: `🔐 *Wallet Export*\n\n⚠️ Never share your private key!`,
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🗑️ Delete", "delete_msg")],
            [Markup.button.callback("🏠 Main Menu", "main_menu")],
          ]),
        },
      );

      const msg = await ctx.replyWithMarkdown(
        `📋 *Quick Copy:*\n\n*Private Key:*\n\`${secretKey}\`\n\n` +
          `*Public Key:*\n\`${keypair.publicKey.toBase58()}\`\n\n` +
          `⏰ _Auto-deletes in 2 minutes_`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🗑️ Delete", "delete_msg")],
        ]),
      );

      setTimeout(() => {
        try {
          ctx.deleteMessage(msg.message_id);
        } catch (e) {}
      }, 120000);
    } catch (error) {
      return ctx.reply("❌ Error exporting keys.");
    }
  });

  bot.action('send_sol', async (ctx) => {
    const userId = ctx.from!.id;
    try {
        const keypair = await getUserKeypair(userId);
        if (!keypair) {
            await ctx.answerCbQuery("❌ No wallet found");
            return ctx.reply("❌ Generate a wallet first.", mainKeyboard());
        }
        const balance = await getBalance(keypair.publicKey);
        if (balance < 0.001) {
            await ctx.answerCbQuery();
            return ctx.replyWithMarkdown(
                `❌ *Insufficient Balance*\n\nCurrent: ${balance.toFixed(4)} SOL\n\n` +
                `💡 Add SOL to your wallet to continue`
            );
        }
        await setSession(userId, { waitingForAmount: true });
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `💸 *Send SOL*\n\n💰 Available: ${balance.toFixed(4)} SOL\n\n` +
            `How much SOL do you want to send?\n\n` +
            `• Type an amount e.g. \`0.5\`\n` +
            `• Or tap *Send Max* below\n\n` +
            `_Type /cancel to abort_`,
            Markup.inlineKeyboard([
                [Markup.button.callback(`📤 Send Max (${(balance - 0.001).toFixed(4)} SOL)`, "send_max")],
                [Markup.button.callback("❌ Cancel", "main_menu")]
            ])
        );
    } catch (error) {
        return ctx.reply("❌ Error initiating transfer.");
    }
  });

  bot.action("settings_menu", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      `⚙️ *Settings*\n\n` + `Manage your bot account and wallet data.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🗑️ Remove Wallet from Bot",
            "delete_wallet_soft",
          ),
        ],
        [
          Markup.button.callback(
            "💣 Full Reset (Delete Everything)",
            "delete_wallet_hard",
          ),
        ],
        [Markup.button.callback("🏠 Main Menu", "main_menu")],
      ]),
    );
  });

  bot.action("delete_wallet_soft", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      `🗑️ *Remove Wallet from Bot*\n\n` +
        `This will:\n` +
        `✅ Remove your wallet from this bot\n` +
        `✅ Keep your funds safe on-chain\n` +
        `✅ You can re-import anytime\n\n` +
        `⚠️ Make sure you have your private key saved before proceeding!\n\n` +
        `_This action cannot be undone._`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Yes, Remove from Bot",
            "confirm_delete_soft",
          ),
        ],
        [Markup.button.callback("❌ Cancel", "main_menu")],
      ]),
    );
  });

  bot.action("delete_wallet_hard", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      `💣 *Full Reset — WARNING*\n\n` +
        `This will:\n` +
        `❌ Delete your wallet from this bot\n` +
        `❌ Delete your encrypted key from database\n` +
        `⚠️ If you haven't saved your private key, *your funds will be lost forever*\n\n` +
        `*Have you exported and saved your private key?*`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Yes, I saved my key — Delete Everything",
            "confirm_delete_hard",
          ),
        ],
        [Markup.button.callback("🔑 Export Key First", "show_private_key")],
        [Markup.button.callback("❌ Cancel", "main_menu")],
      ]),
    );
  });

  bot.action("confirm_delete_soft", async (ctx) => {
    const userId = ctx.from!.id;
    await ctx.answerCbQuery();
    try {
      await prisma.user.delete({
        where: { telegramId: BigInt(userId) },
      });
      await clearSession(userId);
      return ctx.replyWithMarkdown(
        `✅ *Wallet Removed from Bot*\n\n` +
          `Your wallet has been removed from this bot.\n` +
          `Your funds are still safe on-chain.\n\n` +
          `Use /start to generate or import a new wallet.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🏠 Main Menu", "main_menu")],
        ]),
      );
    } catch (error) {
      return ctx.reply("❌ Error removing wallet. Please try again.");
    }
  });

  bot.action("confirm_delete_hard", async (ctx) => {
    const userId = ctx.from!.id;
    await ctx.answerCbQuery();
    try {
      await prisma.user.delete({
        where: { telegramId: BigInt(userId) },
      });
      await clearSession(userId);
      return ctx.replyWithMarkdown(
        `💣 *Full Reset Complete*\n\n` +
          `Everything has been deleted.\n\n` +
          `⚠️ If you didn't save your private key, your funds are now inaccessible.\n\n` +
          `Use /start to create a fresh wallet.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🏠 Main Menu", "main_menu")],
        ]),
      );
    } catch (error) {
      return ctx.reply("❌ Error. Please try again.");
    }
  });

  bot.action('send_max', async (ctx) => {
    const userId = ctx.from!.id;
    try {
        const keypair = await getUserKeypair(userId);
        if (!keypair) return ctx.reply("❌ No wallet found.");
        const balance = await getBalance(keypair.publicKey);
        const maxAmount = Math.max(0, balance - 0.001);
        if (maxAmount <= 0) {
            await ctx.answerCbQuery("❌ Insufficient balance");
            return ctx.reply("❌ Insufficient balance to cover fees.");
        }
        await setSession(userId, { waitingForAddress: true, sendAmount: maxAmount });
        await ctx.answerCbQuery();
        return ctx.replyWithMarkdown(
            `✅ *Max Amount Selected*\n\n` +
            `Sending: ${maxAmount.toFixed(4)} SOL\n\n` +
            `📨 Now enter the *recipient address*:\n\n` +
            `_Type /cancel to abort_`
        );
    } catch (error) {
        return ctx.reply("❌ Error.");
    }
  }); 

  bot.action("delete_msg", (ctx) => ctx.deleteMessage());

  bot.on('text', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (ctx.message.text === '/cancel') {
          await clearSession(userId);
          return ctx.reply("❌ Operation cancelled.", mainKeyboard());
      }

      if (ctx.message.text.startsWith('/')) return;

      const { handleLaunchText } = await import("./launch");
      const userSession = await getSession(userId);
      if (handleLaunchText(userId, ctx.message.text, userSession, ctx)) return;

      if (!userSession?.waitingForAmount && !userSession?.waitingForAddress) return;

      try {
          const userKeypair = await getUserKeypair(userId);
          if (!userKeypair)
              return ctx.reply("❌ No wallet found. Use /start to create one.");

          if (userSession?.waitingForAmount) {
              const input = ctx.message.text.trim().toLowerCase();
              const balance = await getBalance(userKeypair.publicKey);
              let amount: number;

              if (input === "all" || input === "max") {
                  amount = Math.max(0, balance - 0.001);
                  if (amount <= 0)
                      return ctx.reply("❌ Insufficient balance for fees.");
              } else {
                  amount = parseFloat(input);
                  if (isNaN(amount) || amount <= 0)
                      return ctx.reply("❌ Invalid amount.");
                  if (amount > balance)
                      return ctx.replyWithMarkdown(
                          `❌ *Insufficient Balance*\n\nRequested: ${amount} SOL\nAvailable: ${balance.toFixed(4)} SOL`
                      );
              }

              await setSession(userId, { waitingForAddress: true, sendAmount: amount });
              return ctx.replyWithMarkdown(
                  `✅ Amount: ${amount.toFixed(4)} SOL\n\n📨 Now enter the *recipient address*:\n\n_Type /cancel to abort_`
              );
          }

          if (userSession?.waitingForAddress) {
              const address = ctx.message.text.trim();
              const sendAmount = userSession.sendAmount || 0;
              const toPublicKey = new PublicKey(address);

              if (toPublicKey.equals(userKeypair.publicKey))
                  return ctx.reply("❌ Cannot send to yourself!");

              await ctx.replyWithMarkdown(
                  `⏳ *Processing...*\n\nSending ${sendAmount.toFixed(4)} SOL...`
              );

              const transaction = new Transaction().add(
                  SystemProgram.transfer({
                      fromPubkey: userKeypair.publicKey,
                      toPubkey: toPublicKey,
                      lamports: Math.floor(sendAmount * LAMPORTS_PER_SOL),
                  })
              );

              const signature = await sendAndConfirmTransaction(
                  connection, transaction, [userKeypair]
              );
              await saveTransaction(userId, 'send', sendAmount, signature, 'success', 'SOL');
              await clearSession(userId);
              const newBalance = await getBalance(userKeypair.publicKey);

              return ctx.replyWithMarkdown(
                  `✅ *Transaction Successful!*\n\n` +
                  `💰 Sent: ${sendAmount.toFixed(4)} SOL\n` +
                  `📊 New Balance: ${newBalance.toFixed(4)} SOL\n` +
                  `📍 To: \`${address}\`\n\n` +
                  `🔗 [View on Solscan](https://solscan.io/tx/${signature})`,
                  Markup.inlineKeyboard([
                      [Markup.button.url("🌐 Explorer", `https://explorer.solana.com/tx/${signature}`)],
                      [Markup.button.callback("💸 Send More", "send_sol"), Markup.button.callback("🏠 Menu", "main_menu")],
                  ])
              );
          }
      } catch (error: any) {
          await clearSession(userId);
          let msg = "❌ *Transaction Failed*\n\n";
          if (error.message?.includes("invalid")) msg += "Invalid Solana address.";
          else if (error.message?.includes("insufficient")) msg += "Insufficient funds.";
          else msg += error.message || "Unknown error";
          ctx.replyWithMarkdown(msg, mainKeyboard());
      }
  });
}
