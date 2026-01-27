# Use a full Debian-based Node image (Stable environment)
FROM node:20-bookworm

# Install Bun globally
RUN npm install -g bun

# Install OpenSSL 3.0 (Required for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package.json bun.lockb* ./

# Install dependencies using Bun
RUN bun install

# --- THE BRUTE FORCE FIX ---
# We manually create the missing module file that Prisma is crying about.
# This satisfies the 'require' check so the build can finish.
RUN mkdir -p node_modules/@prisma/client/runtime && \
    echo "module.exports = {};" > node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js

# Copy schema and generate
COPY prisma ./prisma/

# Force Binary engine
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Generate
RUN bunx prisma generate

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot
CMD ["bun", "run", "index.ts"]