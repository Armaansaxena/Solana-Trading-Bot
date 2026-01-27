# Stage 1: The Builder (Full Node)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# 1. Install dependencies
RUN npm install

# 2. THE NUCLEAR FIX FOR MODULE ERROR: 
# Manually create the missing module so Prisma doesn't crash during build.
RUN mkdir -p node_modules/@prisma/client/runtime && \
    echo "module.exports = {};" > node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js

# 3. THE FIX FOR 'RECEIVED UNDEFINED': 
# We provide a hardcoded dummy URL ONLY for the generation step.
# This prevents the "Received undefined" error.
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN DATABASE_URL="postgresql://placeholder:password@localhost:5432/db" npx prisma generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]