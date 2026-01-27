# Stage 1: The "Cook" - Use Node + NPM to handle Prisma's complex dependencies
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL (Essential for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy only the files needed for installation
COPY package.json ./
COPY prisma ./prisma/

# ⚠️ CRITICAL: Use NPM for the build phase. 
# NPM downloads the missing WASM/Binary files that Bun skips.
RUN npm install

# Force the stable Binary engine and generate the client
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Stage 2: The "Serve" - High-performance Bun runtime
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy the "cooked" node_modules (with the generated client) from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot with Bun
CMD ["bun", "run", "index.ts"]