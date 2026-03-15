# 🚀 SolBot V2 — Solana Trading Bot

A feature-rich, AI-powered Telegram bot for managing Solana wallets, trading tokens, tracking portfolios, and launching SPL tokens. Built with **TypeScript**, **Prisma**, **PostgreSQL**, and powered by **Groq AI**.

---

## ✨ Features

### 💼 Wallet Management
* 🔐 **Secure Wallet Generation** – Private keys encrypted with **AES-256-CBC** before storage.
* 💰 **Real-time Balance** – Check SOL holdings instantly.
* 💸 **Fast Transfers** – Send SOL with Send Max support.
* 🔑 **Export Keys** – Securely export your private key anytime.
* ⚙️ **Settings** – Soft delete (remove from bot) or full reset.

### 🔄 Trading
* 🔄 **Token Swaps** – Swap SOL, USDC, USDT, BONK, JUP, WIF via **Raydium**.
* 💰 **Live Prices** – Real-time token prices powered by Raydium.
* 📊 **Portfolio Tracker** – View all token balances with USD values.

### 🚀 Token Launch
* 🪙 **SPL Token Launcher** – Deploy your own token on Solana in under 30 seconds.
* 🧙 **Launch Wizard** – Step-by-step guided token creation.

### 🤖 AI Assistant
* 🧠 **Natural Language Commands** – Powered by **Groq (LLaMA 3.3 70B)**.
* 💬 **Examples:** "swap 2 SOL to USDC", "what's my balance", "buy $20 of BONK"

### 📈 Tracking & Alerts
* 🔔 **Price Alerts** – Get notified when tokens hit your target price.
* 👁️ **Watchlist** – Track your favorite tokens in one place.
* 📜 **Transaction History** – Full history with pagination.
* 👥 **Referral System** – Share your link and track referrals.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22 + tsx |
| Bot Framework | Telegraf.js |
| Blockchain | Solana Web3.js + SPL Token |
| DEX Integration | Raydium API |
| AI Layer | Groq (LLaMA 3.3 70B) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Encryption | AES-256-CBC |
| Containerization | Docker & Docker Compose |

---

## 📋 Prerequisites

* Node.js v18+
* PostgreSQL v15+
* Docker & Docker Compose (for containerized setup)
* Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
* Groq API Key (from [console.groq.com](https://console.groq.com))

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Armaansaxena/Solana-Trading-Bot.git
cd Solana-Trading-Bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
BOT_TOKEN=your_telegram_bot_token
ENCRYPTION_KEY=your_32_character_key
DATABASE_URL="postgresql://solana_bot_user:local_password@localhost:5432/solana_bot?schema=public"
GROQ_API_KEY=your_groq_api_key
RPC_URL=https://api.mainnet-beta.solana.com
```

### 4. Start Database
```bash
docker-compose up db -d
```

### 5. Sync Database Schema
```bash
npx prisma db push
npx prisma generate
```

### 6. Run the Bot
```bash
npm run dev
```

---

## 📁 Project Structure
```
SolBot-V2/
├── src/
│   ├── index.ts              # Entry point
│   ├── bot.ts                # Bot + connection instance
│   ├── commands/
│   │   ├── wallet.ts         # Wallet management
│   │   ├── swap.ts           # Token swaps
│   │   ├── portfolio.ts      # Portfolio tracker
│   │   ├── launch.ts         # SPL token launcher
│   │   ├── ai.ts             # AI assistant
│   │   ├── history.ts        # Transaction history
│   │   ├── alerts.ts         # Price alerts
│   │   ├── watchlist.ts      # Token watchlist
│   │   └── referral.ts       # Referral system
│   ├── services/
│   │   ├── solana.ts         # Solana helpers
│   │   └── jupiter.ts        # Raydium swap service
│   ├── keyboards/
│   │   └── index.ts          # All Telegram keyboards
│   ├── types/
│   │   └── index.ts          # Shared TypeScript types
│   └── utils/
│       └── crypto.ts         # AES-256 encryption
├── prisma/
│   └── schema.prisma         # Database schema
├── prisma.config.ts          # Prisma configuration
├── docker-compose.yml        # Local DB orchestration
├── Dockerfile                # Production container
├── .env.example              # Environment template
└── tsconfig.json             # TypeScript config
```

---

## 🔐 Security Architecture

* **Zero-Plaintext Storage** — Private keys never stored as plain text.
* **Unique IVs** — Every key encrypted with a unique Initialization Vector.
* **Environment Isolation** — All secrets managed via non-committed `.env`.
* **Auto-delete** — Private key messages auto-delete after 2 minutes.

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Main menu |
| `/help` | Show all commands |
| `/swap SOL USDC 1` | Swap tokens |
| `/price SOL` | Get token price |
| `/portfolio` | View portfolio |
| `/launch` | Launch a new token |
| `/ai swap 2 SOL to USDC` | AI natural language |
| `/history` | Transaction history |
| `/alert SOL above 200` | Set price alert |
| `/alerts` | View all alerts |
| `/watch SOL` | Add to watchlist |
| `/watchlist` | View watchlist |
| `/referral` | Referral stats & link |
| `/cancel` | Cancel current operation |

---

## 🚀 Deployment

### Docker (Recommended)
```bash
docker-compose up -d
```

### AWS EC2
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Clone and setup
git clone https://github.com/Armaansaxena/Solana-Trading-Bot.git
cd Solana-Trading-Bot
cp .env.example .env
# Fill in .env values
docker-compose up -d
```

---

## 🐛 Troubleshooting

| Error | Fix |
|---|---|
| `P1000 Auth Error` | Check `DATABASE_URL` credentials match `docker-compose.yml` |
| `Port 5432 In Use` | Stop local PostgreSQL service |
| `BOT_TOKEN undefined` | Ensure `.env` file exists with correct values |
| `409 Conflict` | Another bot instance is running — stop it first |
| `Prisma Client Error` | Run `npx prisma generate` after schema changes |

---

## 📝 License

MIT License — feel free to use, modify, and distribute.

---

<div align="center">

**Built for the Solana ecosystem 🌊**

**[⭐ Star this repo](https://github.com/Armaansaxena/Solana-Trading-Bot) if you find it useful!**

**Made with ❤️ by Armaan Saxena**

</div>