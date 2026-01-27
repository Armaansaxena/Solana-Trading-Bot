# Use a full Node image for the build to ensure Prisma engine downloads properly
FROM node:20 AS builder
WORKDIR /app

# Install Bun inside the Node environment
RUN npm install -g bun

# Install system dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy config and schema
COPY package.json bun.lockb* ./
COPY prisma ./prisma/

# Use Bun to install, but because we are in a Node environment, 
# Prisma will download the correct Linux binaries
RUN bun install

# Force binary engine and generate
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN bunx prisma generate

# Final Stage: High performance Bun runtime
FROM oven/bun:latest
WORKDIR /app

# Install OpenSSL for the runtime
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy the generated client and node_modules from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot
CMD ["bun", "run", "index.ts"]