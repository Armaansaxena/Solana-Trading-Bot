# Stage 1: The Builder (Standard Node)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL (Essential for Prisma engines)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy configuration and Prisma schema
COPY package.json ./
COPY prisma ./prisma/

# Use NPM to install - it handles Prisma's engine downloads more reliably than Bun in Docker
RUN npm install

# --- WORKAROUND FOR PRISMA WASM ERROR ---
# This symlink fixes the "Cannot find module ... wasm-base64.js" bug 
# by mapping the expected path to the actual file location in Bun/Node
RUN mkdir -p node_modules/@prisma/client/runtime && \
    ln -sf ../wasm.js node_modules/@prisma/client/runtime/wasm.js || true

# Force Binary engine and Generate
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

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

CMD ["bun", "run", "index.ts"]