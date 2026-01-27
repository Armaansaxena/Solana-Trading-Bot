# Stage 1: Generate Prisma Client using Node (The most stable way)
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
COPY prisma ./prisma/
# Install only what's needed for Prisma
RUN npm install -g bun && bun install
RUN npx prisma generate

# Stage 2: Run the bot using Bun (The high-performance way)
FROM oven/bun:latest
WORKDIR /app

# Install OpenSSL (Required by Prisma to talk to Postgres)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy node_modules (with generated Prisma client) and source code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]