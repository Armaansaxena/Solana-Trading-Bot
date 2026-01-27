# Stage 1: The Builder (Full Node)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL 3.0 and other build essentials
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema
COPY package.json ./
COPY prisma ./prisma/

# 1. Install dependencies using NPM (more stable for Prisma engines)
RUN npm install

# 2. THE FIX: Create the missing runtime folder and symlink the WASM bridge
# This prevents the "Cannot find module ... wasm-base64.js" crash
RUN mkdir -p node_modules/@prisma/client/runtime && \
    ln -sf ../wasm.js node_modules/@prisma/client/runtime/wasm.js || true

# 3. Force Binary engine and Generate using pinned CLI version (6.15.0)
# Version 6.15.0 is the most stable version for this specific Docker/Bun issue
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma@6.15.0 generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy node_modules (with generated client) and source code
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]