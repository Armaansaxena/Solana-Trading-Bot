# Use Bun as base image
FROM oven/bun:latest

# Install curl and openssl (required for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy Prisma schema
COPY prisma ./prisma/

# --- FIX START ---
# Force Prisma to generate a standard client that doesn't 
# rely on broken WASM paths in Bun's Docker environment
RUN bunx --bun prisma generate

# Workaround for the "Cannot find module ... wasm-base64.js" error
# We create a symlink to help Bun find the engine file
RUN ln -sf ../wasm.js node_modules/@prisma/client/runtime/wasm.js || true
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