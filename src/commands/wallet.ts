import { bot } from "../bot";
import { mainKeyboard, walletKeyboard, dangerKeyboard } from "../keyboards";
import { getBalance, getUserKeypair, saveTransaction } from "../services/solana";
import { createEVMWallet, getEVMBalance, getEVMKeypair } from "../services/evm";
import { getEVMProvider, getSolanaConnection } from "../services/rpc";
import { prisma } from "../services/db";
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
import { getSession, setSession, clearSession, getFeePercentage } from "../services/redis";
import { ethers } from "ethers";

const isDevnet = process.env.NETWORK_TYPE === "devnet";

export function registerWalletCommands() {
  bot.action("generate_wallet", async (ctx) => {
    await ctx.answerCbQuery("Generating wallet...");
    const userId = ctx.from!.id;
    try {
      let user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { wallets: true }
      });

      if (!user) {
          // First time user - create both Solana and EVM
          const solKeypair = Keypair.generate();
          const solEnc = encrypt(bs58.encode(solKeypair.secretKey));
          const evmWallet = ethers.Wallet.createRandom();
          const evmEnc = encrypt(evmWallet.privateKey);

          user = await prisma.user.create({
            data: {
              telegramId: BigInt(userId),
              activeChain: "solana",
              wallets: {
                createMany: {
                  data: [
                    {
                      publicKey: solKeypair.publicKey.toBase58(),
                      encryptedKey: solEnc.content,
                      iv: solEnc.iv,
                      name: "Main Solana Wallet",
                      chain: "solana"
                    },
                    {
                      publicKey: evmWallet.address,
                      encryptedKey: evmEnc.content,
                      iv: evmEnc.iv,
                      name: "Main EVM Wallet",
                      chain: "evm"
                    }
                  ]
                }
              }
            },
            include: { wallets: true }
          });

          const solW = user.wallets.find(w => w.chain === "solana");
          await prisma.user.update({
            where: { id: user.id },
            data: { activeWalletId: solW!.id }
          });

          return ctx.replyWithMarkdown(
            `✅ *Wallets Created!*\n\n` +
            `🟣 *Solana:* \`${solKeypair.publicKey.toBase58()}\`\n` +
            `🔹 *EVM:* \`${evmWallet.address}\`\n\n` +
            `_Use the menu to switch between chains._`,
            walletKeyboard("solana")
          );
      }

      // Existing user - generate based on active chain
      const currentChain = user.activeChain || "solana";
      const chainType = (currentChain === "ethereum" || currentChain === "base") ? "evm" : "solana";
      
      const chainWalletsCount = user.wallets.filter(w => w.chain === chainType).length;
      const walletName = `${chainType === "evm" ? "EVM" : "Solana"} Wallet ${chainWalletsCount + 1}`;

      let publicKey = "";
      let encryptedKey = "";
      let iv = "";

      if (chainType === "solana") {
          const kp = Keypair.generate();
          const enc = encrypt(bs58.encode(kp.secretKey));
          publicKey = kp.publicKey.toBase58();
          encryptedKey = enc.content;
          iv = enc.iv;
      } else {
          const wallet = ethers.Wallet.createRandom();
          const enc = encrypt(wallet.privateKey);
          publicKey = wallet.address;
          encryptedKey = enc.content;
          iv = enc.iv;
      }

      const newWallet = await prisma.wallet.create({
          data: {
              userId: user.id,
              publicKey,
              encryptedKey,
              iv,
              name: walletName,
              chain: chainType
          }
      });

      // Set as active
      await prisma.user.update({
          where: { id: user.id },
          data: { activeWalletId: newWallet.id }
      });

      return ctx.replyWithMarkdown(
        `✅ *New ${chainType.toUpperCase()} Wallet Created!*\n\n` +
        `📍 *Name:* ${walletName}\n` +
        `🔑 *Address:* \`${publicKey}\`\n\n` +
        `_This is now your active wallet for ${currentChain.toUpperCase()}._`,
        walletKeyboard(currentChain)
      );

    } catch (error) {
      console.error("Wallet generation error:", error);
      return ctx.reply("❌ Failed to create wallet.");
    }
  });

  bot.action("wallet_menu", async (ctx) => {
    try { await ctx.answerCbQuery(); } catch (e) {}
    
    // Immediate feedback
    try {
        await ctx.editMessageText("⏳ *Loading wallet data...*", { parse_mode: "Markdown" });
    } catch (e) {}

    const userId = ctx.from!.id;
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { wallets: true }
    });

    if (!user || user.wallets.length === 0) {
      return ctx.editMessageText(
        "💳 *Wallet Management*\n\nYou don't have a wallet yet.",
        { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.callback("🆕 Generate Wallets", "generate_wallet")]]) }
      );
    }

    const activeChain = user.activeChain || "solana";
    const chainType = (activeChain === 'ethereum' || activeChain === 'base') ? 'evm' : 'solana';
    
    let activeWallet = user.wallets.find(w => w.chain === chainType);
    
    // Auto-fix: If user is on EVM chain but has no EVM wallet, create one
    if (!activeWallet && chainType === "evm") {
        const evmWallet = ethers.Wallet.createRandom();
        const evmEnc = encrypt(evmWallet.privateKey);
        activeWallet = await prisma.wallet.create({
            data: {
                userId: user.id,
                publicKey: evmWallet.address,
                encryptedKey: evmEnc.content,
                iv: evmEnc.iv,
                name: "Main EVM Wallet",
                chain: "evm"
            }
        });
        await prisma.user.update({
            where: { id: user.id },
            data: { activeWalletId: activeWallet.id }
        });
    } else if (!activeWallet) {
        activeWallet = user.wallets[0];
    }
    
    let balance = 0;
    const symbol = (activeChain === 'ethereum' || activeChain === 'base') ? 'ETH' : 'SOL';

    try {
        if (activeChain === "solana") {
          // 10s timeout
          balance = await Promise.race([
              getBalance(new PublicKey(activeWallet!.publicKey)),
              new Promise<number>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
          ]) as number;
        } else {
          // 10s timeout
          balance = await Promise.race([
              getEVMBalance(activeWallet!.publicKey, activeChain as any),
              new Promise<number>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
          ]) as number;
        }
    } catch (error) {
        console.error("Balance fetch error/timeout:", error);
        balance = 0;
    }

    try {
        return await ctx.editMessageText(
          `💳 *Wallet Management*\n\n` +
          `🌐 *Chain:* ${activeChain.toUpperCase()}\n` +
          `📍 *Wallet:* ${activeWallet!.name}\n` +
          `🔑 *Address:* \`${activeWallet!.publicKey}\`\n` +
          `💰 *Balance:* ${balance.toFixed(4)} ${symbol}\n\n` +
          `Manage your assets below:`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('💰 Balance', 'check_balance'),
                Markup.button.callback(`💸 Send ${symbol}`, 'send_token')
              ],
              [
                Markup.button.callback('🔍 Public Key', 'show_public_key'),
                Markup.button.callback('🔑 Export Key', 'show_private_key')
              ],
              [
                Markup.button.callback('🔄 Switch Wallet', 'switch_wallet_menu'),
                Markup.button.callback('🆕 Add Wallet', 'generate_wallet')
              ],
              [Markup.button.callback('🏠 Back to Menu', 'main_menu')]
            ])
          }
        );
    } catch (error: any) {
        if (error.description?.includes("message is not modified")) return;
        throw error;
    }
  });

  bot.action("check_balance", async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { wallets: true }
    });

    const activeChain = user?.activeChain || "solana";
    const chainType = (activeChain === 'ethereum' || activeChain === 'base') ? 'evm' : 'solana';
    const activeWallet = user?.wallets.find(w => w.chain === chainType);

    if (!user || !activeWallet) return ctx.reply("❌ No wallet found.");

    await ctx.answerCbQuery("Checking...");
    let balance = 0;
    let symbol = activeChain.toUpperCase();

    if (activeChain === "solana") {
      balance = await getBalance(new PublicKey(activeWallet.publicKey));
    } else {
      balance = await getEVMBalance(activeWallet.publicKey, activeChain as any);
      symbol = "ETH";
    }

    return ctx.replyWithMarkdown(
      `💰 *${activeChain.toUpperCase()} Balance*\n\n` +
      `${balance.toFixed(4)} ${symbol}\n\n` +
      `📍 Address:\n\`${activeWallet.publicKey}\``,
      walletKeyboard(activeChain)
    );
  });

  bot.action("show_public_key", async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { wallets: true }
    });
    
    const activeChain = user?.activeChain || "solana";
    const chainType = (activeChain === 'ethereum' || activeChain === 'base') ? 'evm' : 'solana';
    const activeWallet = user?.wallets.find(w => w.chain === chainType);
    
    if (!user || !activeWallet) return ctx.reply("❌ No wallet found.");

    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      `📍 *Your ${activeChain.toUpperCase()} Address:*\n\`${activeWallet.publicKey}\``,
      walletKeyboard(activeChain)
    );
  });

  bot.action("show_private_key", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.replyWithMarkdown(
      "⚠️ *WARNING: EXTREME DANGER*\n\n" +
      "Showing your private key is *extremely dangerous*!\n" +
      "Are you sure you want to continue?",
      dangerKeyboard()
    );
  });

  bot.action("confirm_show_private", async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) }
    });
    if (!user) return ctx.reply("❌ User not found.");

    await ctx.answerCbQuery();
    let privateKey = "";

    if (user.activeChain === "solana") {
      const kp = await getUserKeypair(userId);
      privateKey = bs58.encode(kp!.secretKey);
    } else {
      const kp = await getEVMKeypair(userId);
      privateKey = kp!.privateKey;
    }

    const msg = await ctx.replyWithMarkdown(
      `🔐 *Private Key for ${user.activeChain.toUpperCase()}*\n\n` +
      `\`${privateKey}\`\n\n` +
      `⏰ _Auto-deletes in 1 minute_`,
      Markup.inlineKeyboard([[Markup.button.callback("🗑️ Delete", "delete_msg")]])
    );

    setTimeout(() => { try { ctx.deleteMessage(msg.message_id); } catch (e) {} }, 60000);
  });

  bot.action("send_token", async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        include: { activeWallet: true }
    });

    if (!user || !user.activeWallet) return ctx.reply("❌ No wallet found.");

    await setSession(userId, { waitingForAmount: true });
    await ctx.answerCbQuery();
    
    const symbol = user.activeChain === "solana" ? "SOL" : "ETH";
    return ctx.replyWithMarkdown(
        `💸 *Send ${symbol} (${user.activeChain.toUpperCase()})*\n\n` +
        `Enter the amount you want to send:\n\n` +
        `_Type /cancel to abort_`
    );
  });

  bot.action("switch_wallet_menu", async (ctx) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { wallets: true }
    });
    if (!user) return ctx.reply("❌ User not found.");

    await ctx.answerCbQuery();
    const buttons = user.wallets
      .filter(w => w.chain === (user.activeChain === "solana" ? "solana" : "evm"))
      .map(w => [
        Markup.button.callback(
          `${w.id === user.activeWalletId ? '✅ ' : ''}${w.name}`,
          `confirm_switch_wallet_${w.id}`
        )
      ]);

    buttons.push([Markup.button.callback("🔙 Back", "wallet_menu")]);
    return ctx.editMessageText("🔄 *Switch Wallet*", { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
  });

  bot.action(/^confirm_switch_wallet_(\d+)$/, async (ctx) => {
    const walletId = parseInt((ctx as any).match[1]);
    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data: { activeWalletId: walletId }
    });
    await ctx.answerCbQuery("✅ Switched!");
    return (bot.handleUpdate as any)(ctx.update);
  });

  bot.action("confirm_ai_send", async (ctx) => {
    const userId = ctx.from!.id;
    const userSession = await getSession(userId);
    
    if (!userSession?.receiverAddress || !userSession?.sendAmount) {
        return ctx.answerCbQuery("❌ Session expired or data missing");
    }

    await ctx.answerCbQuery("Processing...");
    return processSend(ctx, userId, userSession.receiverAddress, userSession.sendAmount);
  });

  bot.action("delete_msg", (ctx) => ctx.deleteMessage());

  bot.on('text', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId || ctx.message.text.startsWith('/')) return;

      const userSession = await getSession(userId);
      const { handleLaunchText } = await import("./launch");
      if (await handleLaunchText(userId, ctx.message.text, userSession, ctx)) return;

      if (!userSession?.waitingForAmount && !userSession?.waitingForAddress) return;

      try {
          if (userSession.waitingForAmount) {
              const amount = parseFloat(ctx.message.text);
              if (isNaN(amount) || amount <= 0) return ctx.reply("❌ Invalid amount.");
              
              await setSession(userId, { ...userSession, waitingForAddress: true, waitingForAmount: false, sendAmount: amount });
              return ctx.replyWithMarkdown(`✅ Amount: ${amount}\n\n📨 Enter *recipient address*:`);
          }

          if (userSession.waitingForAddress) {
              const address = ctx.message.text.trim();
              const amount = userSession.sendAmount!;
              return processSend(ctx, userId, address, amount);
          }
      } catch (error: any) {
          await clearSession(userId);
          let userFriendlyError = error.message;
          if (error.code === "INSUFFICIENT_FUNDS") {
              userFriendlyError = "Insufficient funds for transaction + gas fees.";
          }
          ctx.reply(`❌ Failed: ${userFriendlyError}`, mainKeyboard());
      }
  });
}

async function processSend(ctx: any, userId: number, address: string, amount: number) {
    try {
        const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            include: { activeWallet: true }
        });

        const activeChain = user!.activeChain as "solana" | "ethereum" | "base";
        const assetSymbol = (activeChain === "ethereum" || activeChain === "base") ? "ETH" : "SOL";

        // 1. PRODUCTION CHECK: Address Validation
        if (activeChain === "solana") {
            try {
                new PublicKey(address);
            } catch (e) {
                return ctx.reply("❌ Invalid Solana address format. Please check and try again.");
            }
        } else {
            if (!ethers.isAddress(address)) {
                return ctx.reply("❌ Invalid EVM address format (should start with 0x). Please check and try again.");
            }
        }

        // 2. Exact Amount Logic
        const netAmount = amount;
        const feePercent = await getFeePercentage();
        const feeAmount = netAmount * feePercent;
        const requiredTotalBeforeGas = netAmount + feeAmount;

        await ctx.replyWithMarkdown(`⏳ *Checking balance and preparing transaction...*`);

        // 2. Pre-transaction Balance Check
        let currentBalance = 0;
        if (activeChain === "solana") {
            currentBalance = await getBalance(new PublicKey(user!.activeWallet!.publicKey));
        } else {
            currentBalance = await getEVMBalance(user!.activeWallet!.publicKey, activeChain as any);
        }

        if (currentBalance < requiredTotalBeforeGas) {
            return ctx.replyWithMarkdown(
                `❌ *Insufficient Funds*\n\n` +
                `Recipient needs: \`${netAmount} ${assetSymbol}\`\n` +
                `Fees (+${(feePercent * 100).toFixed(2)}%): \`${feeAmount.toFixed(6)} ${assetSymbol}\`\n` +
                `Total required: \`${requiredTotalBeforeGas.toFixed(6)} ${assetSymbol}\`\n\n` +
                `Your balance: \`${currentBalance.toFixed(6)} ${assetSymbol}\`\n\n` +
                `_Please deposit more funds or send a smaller amount._`,
                mainKeyboard(activeChain)
            );
        }

        let signature = "";
        let networkFee = 0;

        if (activeChain === "solana") {
            const kp = await getUserKeypair(userId);
            const treasurySol = process.env.TREASURY_SOL_ADDRESS!;
            const connection = await getSolanaConnection();
            
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: kp!.publicKey,
                    toPubkey: new PublicKey(address),
                    lamports: Math.floor(netAmount * LAMPORTS_PER_SOL),
                }),
                SystemProgram.transfer({
                    fromPubkey: kp!.publicKey,
                    toPubkey: new PublicKey(treasurySol),
                    lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = kp!.publicKey;
            
            const feeInfo = await connection.getFeeForMessage(transaction.compileMessage());
            networkFee = (feeInfo.value || 5000) / LAMPORTS_PER_SOL;

            signature = await connection.sendTransaction(transaction, [kp!]);
            
            let confirmed = false;
            const start = Date.now();
            while (!confirmed && Date.now() - start < 60000) {
                const status = await connection.getSignatureStatus(signature);
                if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
                    confirmed = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            if (!confirmed) throw new Error("Transaction confirmation timeout");
        } else {
            const chain = activeChain as "ethereum" | "base";
            const kp = await getEVMKeypair(userId, chain);
            const provider = await getEVMProvider(chain);
            const wallet = kp!.connect(provider);
            const treasuryEvm = process.env.TREASURY_EVM_ADDRESS!;

            // Estimate Gas
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
            const gasLimit = BigInt(21000); 
            networkFee = parseFloat(ethers.formatEther(gasPrice * gasLimit * BigInt(2)));

            // 1. Send Main Amount (Recipient gets EXACTLY netAmount)
            const tx1 = await wallet.sendTransaction({
                to: address,
                value: ethers.parseEther(netAmount.toString())
            });
            
            // 2. Send Fee
            await wallet.sendTransaction({
                to: treasuryEvm,
                value: ethers.parseEther(feeAmount.toString())
            });

            await tx1.wait();
            signature = tx1.hash;
        }

        await clearSession(userId);
        const totalSpent = requiredTotalBeforeGas + networkFee;

        return ctx.replyWithMarkdown(
            `✅ *Transaction Successful!*\n\n` +
            `📊 *Final Breakdown:*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📤 *Recipient Received:* \`${netAmount.toFixed(6)} ${assetSymbol}\`\n` +
            `💎 *Convenience Fee (${(feePercent * 100).toFixed(2)}%):* \`${feeAmount.toFixed(6)} ${assetSymbol}\`\n` +
            `⛽ *Network Fees:* \`~${networkFee.toFixed(6)} ${assetSymbol}\`\n` +
            `━━━━━━━━━━━━━━━\n` +
            `💰 *Total Deducted:* \`${totalSpent.toFixed(6)} ${assetSymbol}\`\n\n` +
            `🔗 [View Explorer](${activeChain === 'solana' 
                ? `https://solscan.io/tx/${signature}?cluster=${isDevnet ? 'devnet' : 'mainnet'}` 
                : activeChain === 'ethereum' 
                    ? `https://${isDevnet ? 'sepolia.' : ''}etherscan.io/tx/${signature}` 
                    : `https://${isDevnet ? 'sepolia.' : ''}basescan.org/tx/${signature}`})\n\n` +
            `_Recipient received the full amount requested._`,
            mainKeyboard(activeChain)
        );
    } catch (error: any) {
        await clearSession(userId);
        let userFriendlyError = error.message;
        if (error.code === "INSUFFICIENT_FUNDS") {
            userFriendlyError = "Insufficient funds for transaction + gas fees.";
        }
        ctx.reply(`❌ Failed: ${userFriendlyError}`, mainKeyboard());
    }
}
