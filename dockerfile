# Use Bun as base image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Copy Prisma schema first
COPY prisma ./prisma/

# Install dependencies
RUN bun install

# Fix for Prisma WASM issue in Docker/Bun
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Generate Prisma Client
RUN bunx prisma generate

# Copy the rest of your source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]