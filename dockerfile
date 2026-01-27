# Stage 1: Generate Prisma Client using Node & NPM
FROM node:20-slim AS builder
WORKDIR /app

# Install OpenSSL
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./
# We use NPM here because it handles Prisma's WASM dependencies better than Bun during the build phase
RUN npm install

COPY prisma ./prisma/

# Force the binary engine to bypass WASM entirely
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Stage 2: Run the bot using Bun
FROM oven/bun:latest
WORKDIR /app

# Install OpenSSL for runtime
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy the generated client and node_modules from the NPM builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]