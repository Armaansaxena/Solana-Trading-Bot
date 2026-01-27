# 🚀 Solana Trading Bot

A secure Telegram bot for managing Solana wallets, sending SOL, and tracking balances on the Solana blockchain. Built with TypeScript, Telegraf, and MongoDB.

![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## ✨ Features

- 🔐 **Secure Wallet Management** - AES-256 encrypted private keys
- 💰 **Check Balance** - Real-time SOL balance tracking
- 💸 **Send SOL** - Transfer any amount with flexible input
- 📤 **Export Keys** - Secure backup with auto-delete
- 🔑 **Generate Wallets** - Instant Solana wallet creation
- 🗄️ **Persistent Storage** - MongoDB for reliable data storage
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

---

## 📸 Screenshots

```
🚀 Welcome to Solana Trading Bot

Your secure gateway to Solana blockchain

🔹 Create Wallets - Instant generation
🔹 Send SOL - Fast & secure transfers
🔹 Check Balances - Real-time tracking
🔹 Export Keys - Secure backup system

⚠️ Network: Solana DEVNET (test mode)
```

---

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Bot Framework:** [Telegraf](https://telegraf.js.org/)
- **Blockchain:** [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Encryption:** AES-256-CBC
- **Containerization:** Docker & Docker Compose

---

## 📋 Prerequisites

Choose **ONE** of the following setups:

### **Option A: Docker Setup (Recommended)**
- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### **Option B: Local Setup**
- [Bun](https://bun.sh/) v1.0.0 or higher
- [MongoDB](https://www.mongodb.com/try/download/community) v7.0 or higher
- [Node.js](https://nodejs.org/) v18+ (optional, for npm scripts)

### **Common Requirements (Both Options)**
- Telegram account
- Bot token from [@BotFather](https://t.me/botfather)

---

## 🚀 Quick Start

### **🐳 Docker Setup (5 Minutes)**

#### **1. Clone Repository**
```bash
git clone https://github.com/yourusername/solana-trading-bot.git
cd solana-trading-bot
```

#### **2. Create Environment File**
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb://admin:changeme123@mongodb:27017/solana-bot?authSource=admin
MONGO_USERNAME=admin
MONGO_PASSWORD=changeme123
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

**Generate Encryption Key:**
```bash
# Linux/Mac
openssl rand -hex 16

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

#### **3. Start Services**
```bash
docker-compose up -d
```

#### **4. Verify Deployment**
```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs -f bot
```

**Expected Output:**
```
✅ Connected to MongoDB
📊 Database: solana-bot
🔗 Host: mongodb
✅ Solana Trading Bot is running!
📍 Network: Solana Devnet
🤖 Bot started at ...
```

#### **5. Test Bot**
Open Telegram, find your bot, and send `/start`

---

### **💻 Local Setup (10 Minutes)**

#### **1. Clone Repository**
```bash
git clone https://github.com/yourusername/solana-trading-bot.git
cd solana-trading-bot
```

#### **2. Install Dependencies**
```bash
bun install
```

#### **3. Setup MongoDB**

**Option A: Use Docker for MongoDB Only**
```bash
docker run -d \
  --name solana-bot-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=solana-bot \
  -v mongodb_data:/data/db \
  mongo:7.0
```

**Option B: Install MongoDB Locally**

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Windows:**
- Download from: https://www.mongodb.com/try/download/community
- Run installer
- Choose "Complete" installation
- Check "Install MongoDB as a Service"

#### **4. Create Environment File**
```bash
cp .env.example .env
```

Edit `.env`:
```env
BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb://localhost:27017/solana-bot
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

#### **5. Run Bot**
```bash
bun run index.ts
```

**Expected Output:**
```
✅ Connected to MongoDB
📊 Database: solana-bot
🔗 Host: localhost
✅ Solana Trading Bot is running!
📍 Network: Solana Devnet
🤖 Bot started at ...
```

---

## 📁 Project Structure

```
solana-trading-bot/
├── index.ts                 # Main bot application
├── models/
│   └── User.ts             # MongoDB user schema
├── utils/
│   └── crypto.ts           # Encryption/decryption utilities
├── db.ts                   # MongoDB connection
├── .env                    # Environment variables (create this)
├── .env.example            # Environment template
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── .dockerignore           # Docker ignore rules
└── .gitignore              # Git ignore rules
```

---

## 🎮 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and see main menu |
| `/help` | Display help and features |
| `/about` | Show bot information |
| `/cancel` | Cancel current operation |

---

## 🔧 Configuration

### **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BOT_TOKEN` | Telegram bot token from BotFather | ✅ Yes | - |
| `MONGODB_URI` | MongoDB connection string | ✅ Yes | `mongodb://localhost:27017/solana-bot` |
| `ENCRYPTION_KEY` | 32-character encryption key | ✅ Yes | - |
| `MONGO_USERNAME` | MongoDB username (Docker only) | ⚠️ Docker | `admin` |
| `MONGO_PASSWORD` | MongoDB password (Docker only) | ⚠️ Docker | `changeme123` |

---

## 🔐 Security Features

- **AES-256-CBC Encryption** - All private keys encrypted before storage
- **Initialization Vectors** - Unique IV for each encrypted key
- **Environment Variables** - No secrets in code
- **Auto-Delete Messages** - Sensitive data auto-deletes after 2 minutes
- **Input Validation** - All user inputs sanitized
- **No Plain Text Storage** - Private keys never stored unencrypted

---

## 🧪 Testing

### **Get Devnet SOL (Free)**

1. Generate wallet in bot
2. Copy your public key
3. Visit: https://faucet.solana.com
4. Paste your public key
5. Select "Devnet"
6. Request airdrop (2 SOL)
7. Wait 10-30 seconds
8. Check balance in bot

### **Test Transactions**

1. Generate two wallets (or use a friend's wallet)
2. Get devnet SOL for first wallet
3. Send SOL from wallet 1 to wallet 2
4. Verify transaction on Solscan
5. Check updated balances

---

## 🐳 Docker Commands

### **Start Services**
```bash
docker-compose up -d
```

### **Stop Services**
```bash
docker-compose down
```

### **View Logs**
```bash
# All services
docker-compose logs -f

# Bot only
docker-compose logs -f bot

# MongoDB only
docker-compose logs -f mongodb
```

### **Restart Services**
```bash
docker-compose restart
```

### **Rebuild and Start**
```bash
docker-compose up -d --build
```

### **Access MongoDB Shell**
```bash
docker exec -it solana-bot-mongo mongosh -u admin -p changeme123
```

### **View Database**
```javascript
// Inside mongosh
use solana-bot
show collections
db.users.find().pretty()
```

---

## 💾 Database Management

### **Backup MongoDB**
```bash
# Docker
docker exec solana-bot-mongo mongodump --out /backup
docker cp solana-bot-mongo:/backup ./mongodb-backup

# Local
mongodump --db solana-bot --out ./mongodb-backup
```

### **Restore MongoDB**
```bash
# Docker
docker cp ./mongodb-backup solana-bot-mongo:/backup
docker exec solana-bot-mongo mongorestore /backup

# Local
mongorestore --db solana-bot ./mongodb-backup/solana-bot
```

### **View Data in MongoDB Compass**
```bash
# Connection string
mongodb://localhost:27017/solana-bot

# Or for Docker with auth
mongodb://admin:changeme123@localhost:27017/solana-bot?authSource=admin
```

---

## 🚀 Deployment

### **Deploy to Railway**

1. Push code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project from GitHub repo
4. Add MongoDB service
5. Set environment variables
6. Deploy!

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guides.

### **Deploy to DigitalOcean**

1. Create droplet with Docker
2. Clone repository
3. Create `.env` file
4. Run `docker-compose up -d`

### **Deploy to Render**

1. Connect GitHub repository
2. Set environment to Docker
3. Add environment variables
4. Deploy!

---

## 🐛 Troubleshooting

### **Bot Not Responding**

```bash
# Check if bot is running
docker-compose ps

# View bot logs
docker-compose logs bot

# Restart bot
docker-compose restart bot
```

### **MongoDB Connection Error**

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Verify connection string in .env
cat .env | grep MONGODB_URI
```

### **"ENCRYPTION_KEY must be exactly 32 characters"**

```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Update .env with the output
```

### **Port 27017 Already in Use**

```bash
# Find process using port
netstat -ano | findstr :27017  # Windows
lsof -i :27017                 # Mac/Linux

# Stop MongoDB service
net stop MongoDB                # Windows
brew services stop mongodb      # Mac
sudo systemctl stop mongod      # Linux

# Or change port in docker-compose.yml
ports:
  - "27018:27017"
```

---

## 📊 Monitoring

### **Health Checks**

```bash
# Check bot health
curl http://localhost:3000/health

# Check MongoDB
docker exec solana-bot-mongo mongosh --eval "db.adminCommand('ping')"
```

### **Resource Usage**

```bash
# View container stats
docker stats

# View logs with timestamps
docker-compose logs -f --timestamps
```

---

## 🔄 Updates

### **Update Bot**

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose up -d --build

# Or for local
bun install
bun run index.ts
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

This bot is currently configured for **Solana DEVNET** (test network). 

**For production use on MAINNET:**
- Audit all security measures
- Implement rate limiting
- Add transaction history
- Set up monitoring and alerts
- Use production-grade MongoDB
- Implement proper backup strategies
- Add 2FA for sensitive operations
- Test extensively on devnet first

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/solana-trading-bot/issues)
- **Telegram:** [@YourSupportUsername](https://t.me/YourSupportUsername)
- **Email:** your.email@example.com

---

## 🎯 Roadmap

- [x] Basic wallet generation
- [x] Send SOL transactions
- [x] Balance checking
- [x] Private key export
- [x] Docker support
- [ ] Transaction history
- [ ] SPL token support
- [ ] Swap functionality (Jupiter/Raydium)
- [ ] Portfolio tracking
- [ ] Price alerts
- [ ] Multi-language support
- [ ] Mainnet support

---

## 🌟 Acknowledgments

- [Solana Foundation](https://solana.com/) for the blockchain
- [Telegram](https://telegram.org/) for the Bot API
- [MongoDB](https://www.mongodb.com/) for the database
- [Bun](https://bun.sh/) for the amazing runtime

---

## 📈 Stats

![GitHub Stars](https://img.shields.io/github/stars/yourusername/solana-trading-bot?style=social)
![GitHub Forks](https://img.shields.io/github/forks/yourusername/solana-trading-bot?style=social)
![GitHub Issues](https://img.shields.io/github/issues/yourusername/solana-trading-bot)
![GitHub License](https://img.shields.io/github/license/yourusername/solana-trading-bot)

---

<div align="center">

### Made with ❤️ for the Solana Community

**[⭐ Star this repo](https://github.com/yourusername/solana-trading-bot)** if you find it useful!

</div>