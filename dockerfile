# Stage 1: The Builder (Use Full Node, not slim)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL (Essential for Prisma engines)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy configuration and Prisma schema
COPY package.json ./
COPY prisma ./prisma/

# 1. Use NPM for the build phase (it handles Prisma's engines better than Bun in Docker)
RUN npm install

# 2. THE FIX: Create the missing runtime folder and symlink the bridge
# This bypasses the "Cannot find module ... wasm-base64.js" crash
RUN mkdir -p node_modules/@prisma/client/runtime && \
    ln -sf ../wasm.js node_modules/@prisma/client/runtime/wasm.js || true

# 3. Force Binary engines and Generate the client
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies for Solana/Postgres
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy ONLY the node_modules and code from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check using your health server
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot
CMD ["bun", "run", "index.ts"]