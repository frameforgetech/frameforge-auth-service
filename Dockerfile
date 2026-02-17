# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared contracts first
COPY frameforge-shared-contracts/package*.json ./shared-contracts/
COPY frameforge-shared-contracts/tsconfig.json ./shared-contracts/
COPY frameforge-shared-contracts/src ./shared-contracts/src/

# Build shared contracts
WORKDIR /app/shared-contracts
RUN npm ci && npm run build

# Copy auth service files
WORKDIR /app/auth-service
COPY frameforge-auth-service/package*.json ./

# Install dependencies (will use the local shared-contracts)
RUN npm ci

# Copy source code
COPY frameforge-auth-service/src ./src/
COPY frameforge-auth-service/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Set up shared contracts directory
WORKDIR /app/shared-contracts
COPY --from=builder /app/shared-contracts/package*.json ./
COPY --from=builder /app/shared-contracts/dist ./dist/

# Set up auth service directory
WORKDIR /app/auth-service
COPY frameforge-auth-service/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/auth-service/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Start the service
CMD ["node", "dist/index.js"]
