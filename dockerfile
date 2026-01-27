# Use Bun as base image
FROM oven/bun:latest

# Install OpenSSL (Required for Prisma engines to run in Linux)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Copy Prisma schema first
COPY prisma ./prisma/

# Install dependencies
RUN bun install

# Force Prisma to use the Library engine (Standard for Bun/Node)
# and avoid the WASM-base64 issue
ENV PRISMA_CLIENT_ENGINE_TYPE=library

# Generate Prisma Client
RUN bunx prisma generate

# Copy the rest of your source code
COPY . .

# Expose port (Health check server)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]