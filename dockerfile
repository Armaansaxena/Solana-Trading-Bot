# Stage 1: Generate Prisma Client using Node
FROM node:20-slim AS builder
WORKDIR /app

# Install OpenSSL and other essentials in the BUILDER stage
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install -g bun && bun install

# Force the engine type to library to prevent the WASM-base64 error
ENV PRISMA_CLIENT_ENGINE_TYPE=library
RUN npx prisma generate

# Stage 2: Run the bot using Bun
FROM oven/bun:latest
WORKDIR /app

# Install OpenSSL in the RUNTIME stage
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