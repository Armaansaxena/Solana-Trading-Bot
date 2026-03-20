# 🚀 SolBot V2 — Automated Solana Trading Engine

<div align="center">

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Solana](https://img.shields.io/badge/Solana-Web3-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Docker](https://img.shields.io/badge/Docker-Containerized-blue)

### ⚡ Secure, AI-Powered DeFi Trading Bot with Real-Time Execution

A production-grade trading bot built on Solana that enables **automated trading, portfolio management, and token launches**, with **secure key handling and real-time monitoring via Telegram**.

---

## 🎥 Demo Video

👉 Watch the bot in action: https://youtu.be/lnwwbN_f3Yg?si=o-x079ibP0ZT5v9B

## 🔗 Live Demo

👉 Try the bot here: https://t.me/ArmEthSol_bot

</div>

---

## 🎯 Problem Statement


## ⚡ Key Highlights

* 🤖 **Automated Token Swaps** via Raydium/Jupiter
* 🔐 **AES-256 Encrypted Key Management** (no plaintext exposure)
* 📡 **Real-Time Trading via Telegram Bot Interface**
* 🧠 **AI-Powered Commands (Groq LLaMA 3.3 70B)**
* 💼 **Portfolio Tracking & Analytics**
* 🚀 **One-Click SPL Token Launch**
* 🐳 **Dockerized Deployment (AWS Ready)**

---

## 🧠 System Architecture

```id="arch001"
User (Telegram)
        ↓
Bot Interface (Telegraf.js)
        ↓
Backend Engine (Node.js + TypeScript)
        ↓
Trading Logic Layer
        ↓
DEX APIs (Raydium / Jupiter)
        ↓
Solana Blockchain
        ↓
Database (PostgreSQL via Prisma)
```

---

## 🛠️ Tech Stack

**Backend:** Node.js, TypeScript, Telegraf.js\
**Blockchain:** Solana Web3.js, SPL Token\
**DEX Integration:** Raydium API / Jupiter Aggregator\
**AI Layer:** Groq (LLaMA 3.3 70B)\
**Database:** PostgreSQL + Prisma ORM\
**Security:** AES-256-CBC Encryption\
**DevOps:** Docker, Docker Compose, AWS EC2

---

## 🔐 Security Architecture

* 🔒 Private keys encrypted using **AES-256-CBC**
* 🚫 No plaintext storage of sensitive data
* 🔁 Unique IV per encryption instance
* 🧾 Secure transaction signing flow
* ⏳ Auto-deletion of sensitive messages

---

## 📊 Core Functionalities

### 💼 Wallet Management

* Secure wallet generation
* Real-time SOL balance tracking
* Fast transfers with max-send support

---

### 🔄 Trading Engine

* Token swaps (SOL, USDC, BONK, JUP, WIF)
* Real-time price fetching
* Automated execution logic

---

### 📈 Portfolio & Tracking

* Multi-token portfolio tracking
* Transaction history with pagination
* Price alerts & watchlist

---

### 🚀 Token Launch System

* Deploy SPL tokens in seconds
* Guided launch wizard

---

### 🤖 AI Assistant

* Natural language commands
* Example:

  * “Swap 2 SOL to USDC”
  * “Check my portfolio”

---

## 🚀 Deployment

### Docker (Recommended)

```bash id="deploy2"
docker-compose up -d
```

### Local Setup

```bash id="deploy3"
npm install
npx prisma db push
npm run dev
```

---

## 📁 Project Structure

```
src/
 ├── commands/        # Bot commands (wallet, swap, AI,alerts)
 ├── services/        # Blockchain + API integrations
 ├── utils/           # Encryption & helpers
 ├── prisma/          # Database schema
 └── bot.ts           # Main bot logic
```

---

## 📈 Why This Project Stands Out

This is NOT a basic bot.

It demonstrates:

* ⚡ Backend system architecture
* 🔐 Security-first engineering
* 🤖 AI integration in real-world workflows
* ☁️ Cloud-ready deployment
* 🧠 Deep understanding of DeFi systems

---

## 🔮 Future Improvements

* 📊 Strategy-based trading (AI/ML)
* 📈 Risk management engine
* 🌐 Multi-chain support (Ethereum, Base)
* 📉 Advanced analytics dashboard

---

## 👨‍💻 Author

**Armaan Saxena**
GitHub: https://github.com/Armaansaxena

---

## ⭐ Final Note

This project reflects:

* Real-world backend engineering
* Secure infrastructure design
* Production-ready Web3 system building

---

<div align="center">

⭐ Star this repo if you find it valuable!

</div>
