# Use a full Node.js image to ensure all module paths are resolved correctly
FROM node:20

# Install Bun globally inside the Node environment
RUN npm install -g bun

# Install OpenSSL and dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies using Bun
RUN bun install

# Copy Prisma schema
COPY prisma ./prisma/

# Force the Binary engine and generate
# Setting these before generation ensures Prisma uses the stable executable
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN bunx prisma generate

# Copy the rest of your source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the bot using Bun
CMD ["bun", "run", "index.ts"]