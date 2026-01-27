# Use a full Debian-based Node image
FROM node:20-bookworm

# Install Bun globally
RUN npm install -g bun

# Install OpenSSL 3.0 (Required for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# THE FIX FOR THE MODULE ERROR: Manual bridge file
RUN mkdir -p node_modules/@prisma/client/runtime && \
    echo "module.exports = {};" > node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js

# Copy schema
COPY prisma ./prisma/

# --- THE ABSOLUTE FIX FOR 'RECEIVED UNDEFINED' ---
# 1. Define the ARG
ARG DATABASE_URL="postgresql://placeholder:password@localhost:5432/db"
# 2. Assign ARG to ENV so it's available in the shell
ENV DATABASE_URL=$DATABASE_URL
# 3. Force Binary engines
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Run generate using a direct shell to ensure ENV is picked up
RUN DATABASE_URL=$DATABASE_URL bunx prisma generate
# --- END FIX ---

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot
CMD ["bun", "run", "index.ts"]