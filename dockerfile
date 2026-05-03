# Stage 1: Build
FROM node:22 AS builder
WORKDIR /app

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy package files
COPY package.json ./

# CRITICAL: Copy prisma folder BEFORE npm install to satisfy postinstall scripts
COPY prisma ./prisma/

# Install dependencies (Node 22 satisfies the @prisma/streams-local requirement)
RUN npm install

# Force Prisma to use the Library engine
ENV PRISMA_CLIENT_ENGINE_TYPE=library
RUN npx prisma generate

# Stage 2: Runtime
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
# Copy the rest of the source code
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 1. Sync the database tables (db push)
# 2. Start the bot using index.ts
CMD ["sh", "-c", "bunx prisma db push && bun run src/bot.ts"]