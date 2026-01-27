# Use a full Node.js image to ensure all module paths are resolved correctly
FROM node:20

# Install Bun globally inside the Node environment
RUN npm install -g bun

# Install OpenSSL and system essentials
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# 1. Install dependencies using Bun
# 2. Fix: Manual symlink for the WASM bridge error
RUN bun install && \
    mkdir -p node_modules/@prisma/client/runtime && \
    ln -sf ../wasm.js node_modules/@prisma/client/runtime/wasm.js || true

# Copy Prisma schema
COPY prisma ./prisma/

# Force the Binary engine before generating
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Generate Prisma Client
RUN bunx prisma generate

# Copy the rest of your source code
COPY . .

# Expose port
EXPOSE 3000

# Health check using the bot's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot using Bun
CMD ["bun", "run", "index.ts"]