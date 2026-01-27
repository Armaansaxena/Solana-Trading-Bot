# Stage 1: The Builder (Use Full Node)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

COPY package.json ./
# Use NPM to avoid Bun's engine-skipping behavior
RUN npm install

COPY prisma ./prisma/

# THE NUCLEAR FIX: Create a .env file PHYSICALLY in the container.
# This is the only way to guarantee Prisma 'sees' a string during build.
RUN echo 'DATABASE_URL="postgresql://db:db@localhost:5432/db"' > .env

# Generate without engines to bypass the WASM/Buffer crash
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env ./.env
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot
CMD ["bun", "run", "index.ts"]