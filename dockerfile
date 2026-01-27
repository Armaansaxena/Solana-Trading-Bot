# Use Bun as base image
FROM oven/bun:latest

# Install OpenSSL and Curl (Prisma needs these for the Binary engine)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Copy Prisma schema
COPY prisma ./prisma/

# Install dependencies
RUN bun install

# --- FIX START ---
# Force Prisma to download the Linux binary engines
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Tell Prisma to look for the binary in the local node_modules
# This prevents the WASM-base64 error
RUN bunx prisma generate
# --- FIX END ---

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]