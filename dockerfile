# Stage 1: The Builder (Full Node)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL (Essential for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./
# Use NPM to ensure all Prisma engine components are downloaded
RUN npm install

COPY prisma ./prisma/

# --- THE BRUTE FORCE FIX ---
# 1. Satisfy the WASM bridge check
RUN mkdir -p node_modules/@prisma/client/runtime && \
    echo "module.exports = {};" > node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js

# 2. Force generate using a shell-injected variable.
# We use 'sh -c' to ensure the variable is treated as a literal string.
RUN PRISMA_CLI_QUERY_ENGINE_TYPE=binary \
    PRISMA_CLIENT_ENGINE_TYPE=binary \
    DATABASE_URL="postgresql://db:db@localhost:5432/db" \
    npx prisma generate
# --- END FIX ---

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy cooked node_modules and source code
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

# Health check using the bot's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]