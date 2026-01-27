# Use Bun as base image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Copy Prisma schema first (to optimize caching)
COPY prisma ./prisma/

# Install dependencies (Prisma needs to be installed to generate)
RUN bun install

# Generate Prisma Client (CRITICAL STEP)
RUN bunx prisma generate

# Copy the rest of your source code
COPY . .

# Expose port
EXPOSE 3000

# Health check (Using your health server endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]