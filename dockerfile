# Stage 1: Build & Generate (Using Node.js)
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL (Essential for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy config and schema
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies using NPM (much more stable for Prisma generation)
RUN npm install

# --- THE MAGIC FIX ---
# Force Prisma to use the Binary engine and generate the client
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Stage 2: Runtime (Using Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies for Solana & PostgreSQL
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy the "already cooked" node_modules and generated client from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port for Render health check
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot with Bun
CMD ["bun", "run", "index.ts"]