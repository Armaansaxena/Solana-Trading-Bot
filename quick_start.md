# ⚡ Quick Start Cheat Sheet

## 🐳 Docker Setup (Recommended)

```bash
# 1. Clone & Navigate
git clone https://github.com/yourusername/solana-trading-bot.git
cd solana-trading-bot

# 2. Create .env
cp .env.example .env
# Edit .env with your values

# 3. Start Everything
docker-compose up -d

# 4. Check Status
docker-compose ps

# 5. View Logs
docker-compose logs -f bot

# 6. Stop Everything
docker-compose down
```

**✅ Done! Bot is live on Telegram**

---

## 💻 Local Setup

```bash
# 1. Clone & Navigate
git clone https://github.com/yourusername/solana-trading-bot.git
cd solana-trading-bot

# 2. Install Dependencies
bun install

# 3. Start MongoDB (choose one)
# Option A: Docker MongoDB only
docker run -d --name solana-bot-mongo -p 27017:27017 mongo:7.0

# Option B: Local MongoDB
# (Install from mongodb.com first)
brew services start mongodb-community  # Mac
net start MongoDB                      # Windows
sudo systemctl start mongod            # Linux

# 4. Create .env
cp .env.example .env
# Edit with: MONGODB_URI=mongodb://localhost:27017/solana-bot

# 5. Run Bot
bun run index.ts
```

**✅ Done! Bot is live on Telegram**

---

## 🔑 Generate Encryption Key

```bash
# Choose any method:

# Method 1: Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Method 2: OpenSSL (Mac/Linux)
openssl rand -hex 16

# Method 3: Online
# Visit: https://www.random.org/strings/
# Generate: 32 characters, hexadecimal

# Copy output to .env as ENCRYPTION_KEY
```

---

## 🤖 Get Bot Token

```
1. Open Telegram
2. Search: @BotFather
3. Send: /newbot
4. Enter name: Solana Trading Bot
5. Enter username: YourUniqueSolanaBot_bot
6. Copy token to .env as BOT_TOKEN
```

---

## 📊 MongoDB Options

### **Local MongoDB**
```env
MONGODB_URI=mongodb://localhost:27017/solana-bot
```

### **Docker MongoDB**
```env
MONGODB_URI=mongodb://admin:changeme123@mongodb:27017/solana-bot?authSource=admin
MONGO_USERNAME=admin
MONGO_PASSWORD=changeme123
```

### **MongoDB Atlas**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/solana-bot?retryWrites=true&w=majority
```

---

## 🧪 Test Bot

```
1. Open Telegram
2. Search for your bot
3. Send: /start
4. Click: Generate Wallet
5. Get SOL: https://faucet.solana.com
6. Test: Send SOL
```

---

## 🔧 Common Commands

```bash
# Docker
docker-compose up -d          # Start
docker-compose down           # Stop
docker-compose restart        # Restart
docker-compose logs -f bot    # View logs
docker-compose ps             # Status

# Local
bun run index.ts              # Start bot
bun install                   # Install deps
bun update                    # Update deps

# MongoDB
docker exec -it solana-bot-mongo mongosh  # Docker
mongosh                                    # Local
```

---

## 🐛 Troubleshooting

### Bot Not Responding
```bash
docker-compose logs bot       # Check logs
docker-compose restart bot    # Restart
```

### MongoDB Connection Error
```bash
docker-compose ps             # Check running
docker-compose logs mongodb   # Check logs
```

### Port 27017 In Use
```bash
# Stop MongoDB service
net stop MongoDB              # Windows
brew services stop mongodb    # Mac
sudo systemctl stop mongod    # Linux

# Or use different port
# In docker-compose.yml: "27018:27017"
# In .env: mongodb://localhost:27018/solana-bot
```

---

## 📁 Essential Files

```
.env              # Your secrets (don't commit!)
.env.example      # Template
index.ts          # Main bot code
models/User.ts    # Database schema
utils/crypto.ts   # Encryption
db.ts             # Database connection
Dockerfile        # Docker config
docker-compose.yml # Docker services
```

---

## 🚀 Deploy

### Railway (Easiest)
```bash
1. Push to GitHub
2. Go to railway.app
3. New Project → GitHub repo
4. Add MongoDB service
5. Set env variables
6. Deploy!
```

### DigitalOcean
```bash
1. Create Docker droplet
2. SSH into server
3. Clone repo
4. Create .env
5. docker-compose up -d
```

---

## 📞 Get Help

- 📖 Full docs: README.md
- 🐛 Issues: GitHub Issues
- 💬 Telegram: @YourSupportUsername

---

## ⚡ Quick Reference

| Action | Docker | Local |
|--------|--------|-------|
| Start | `docker-compose up -d` | `bun run index.ts` |
| Stop | `docker-compose down` | `Ctrl+C` |
| Logs | `docker-compose logs -f` | Console output |
| Restart | `docker-compose restart` | Re-run command |
| Status | `docker-compose ps` | Check terminal |

---

**🎉 That's it! You're ready to go!**