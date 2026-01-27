# Stage 1: The Builder
FROM node:20 AS builder
WORKDIR /app

# Install OpenSSL
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates

# Copy only schema and package files
COPY package.json ./
COPY prisma ./prisma/

# 1. Install dependencies
# 2. Force download of the binary engine
# 3. Generate the client
RUN npm install
RUN npx prisma generate

# Stage 2: The Runtime (Bun)
FROM oven/bun:latest
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "index.ts"]