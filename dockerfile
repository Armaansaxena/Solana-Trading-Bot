# Stage 1: The Builder
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL 
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

COPY package.json ./

# 1. Install dependencies
# 2. Explicitly install engines to ensure WASM/Binary files are downloaded
RUN npm install && npm install @prisma/engines

COPY prisma ./prisma/

# Force Prisma to use the Library engine (Standard Node-API)
ENV PRISMA_CLIENT_ENGINE_TYPE=library
RUN npx prisma generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy cooked node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "index.ts"]