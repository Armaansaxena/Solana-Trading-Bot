# Use a full Node image for the build stage to ensure Prisma downloads everything correctly
FROM node:20 AS builder
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy package files and Prisma schema
COPY package.json ./
COPY prisma ./prisma/

# Use NPM to install - it handles Prisma's engines and WASM bridge much better than Bun
RUN npm install

# --- THE CRITICAL FIX ---
# Force Prisma to generate a C-binding library engine instead of WASM
ENV PRISMA_CLIENT_ENGINE_TYPE=library
RUN npx prisma generate

# Final Stage: High performance Bun runtime
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy the generated client and node_modules from the NPM builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot with Bun
CMD ["bun", "run", "index.ts"]