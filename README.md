# 🚀 Solana Trading Bot

A high-performance, secure Telegram bot for managing Solana wallets, sending SOL, and tracking balances. Engineered with **TypeScript**, **Prisma**, and **PostgreSQL** for maximum reliability and type-safety.

---

## ✨ Features

* 🔐 **Secure Wallet Management** – Private keys are encrypted using **AES-256-CBC** before storage.
* 💰 **Real-time Balance Tracking** – Check SOL holdings instantly via Solana Web3.js.
* 💸 **Fast Transfers** – Send SOL to any wallet address with a single message.
* 🔑 **Instant Wallet Generation** – Create a new Solana wallet directly through Telegram.
* 🗄️ **Relational Storage** – Powered by **PostgreSQL** for structured data handling.
* 🐳 **Containerized** – Ready for production with a robust Docker setup.

---

## 🛠️ Tech Stack

* **Runtime:** [Bun](https://bun.sh/)
* **Bot Framework:** [Telegraf](https://telegraf.js.org/)
* **Blockchain API:** [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
* **ORM:** [Prisma](https://www.prisma.io/)
* **Database:** [PostgreSQL](https://www.postgresql.org/)
* **Containerization:** Docker & Docker Compose

---

## 📋 Prerequisites

### **Option A: Docker Setup (Recommended)**
* Docker Desktop & Docker Compose installed.

### **Option B: Local Setup**
* Bun v1.0.0+ and PostgreSQL v15+ installed.

---

## 🚀 Quick Start (Docker)

### 1. Clone the Repository
```bash
git clone [https://github.com/Armaansaxena/Solana-Trading-Bot.git](https://github.com/Armaansaxena/Solana-Trading-Bot.git)
cd Solana-Trading-Bot

```

### 2. Configure Environment

```bash
cp .env.example .env

```

**Edit `.env` and fill in your secrets:**

```text
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL="postgresql://solana_bot_user:local_password@db:5432/solana_bot?schema=public"
ENCRYPTION_KEY=your_32_character_encryption_key_here

```

### 3. Launch & Sync

```bash
# Start the containers
docker-compose up -d 

# Sync the Prisma schema
bunx prisma db push

```

---

### 📁 Project Structure

```text
Solana-Trading-Bot/
├── prisma/
│   └── schema.prisma       # Database schema & models
├── utils/
│   └── crypto.ts           # AES-256 Encryption logic
├── .env                    # Secrets & Config (Hidden)
├── Dockerfile              # Production container config
├── docker-compose.yml      # Local database orchestration
├── index.ts                # Main entry point & Bot logic
├── package.json            # Project dependencies
└── tsconfig.json           # TypeScript settings

```

---

## 🔐 Security Architecture

* **Zero-Plaintext Storage:** Private keys never exist as plain text in the database.
* **Unique Salts:** Every user’s key is encrypted with a unique Initialization Vector (IV).
* **Environment Isolation:** Credentials are managed via non-committed environment variables.

---

## 🚀 Deployment (Render)

1. **Postgres:** Create a **New > PostgreSQL** instance.
2. **Web Service:** Create a **New > Web Service**, connect GitHub, and set runtime to **Docker**.
3. **Env Vars:** Add `DATABASE_URL` (Internal URL), `BOT_TOKEN`, and `ENCRYPTION_KEY`.
4. **Build Command:**

```bash
bun install && bunx prisma generate && bunx prisma db push

```

---

## 🐛 Troubleshooting

* **P1000 (Auth Error):** Ensure `DATABASE_URL` credentials match `docker-compose.yml`.
* **Port 5432 In Use:** Stop any local Postgres service running on your host machine.
* **Prisma Client:** Run `bunx prisma generate` if you modify the schema.

---

## 📝 License

This project is licensed under the **MIT License**.

<div align="center">

**Made with ❤️ for the Solana Community**

**[⭐ Star this repo](https://github.com/Armaansaxena/Solana-Trading-Bot) if you find it useful!**

</div>

