# Stage 1: Build
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL 3.0
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

COPY package.json ./
# Use NPM to ensure all Prisma engine components are downloaded
RUN npm install

COPY prisma ./prisma/

# Force Prisma to use the Library engine (Standard Node-API)
# This avoids the WASM errors entirely
ENV PRISMA_CLIENT_ENGINE_TYPE=library
RUN npx prisma generate

# Stage 2: Runtime
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot with Bun
CMD ["bun", "run", "index.ts"]