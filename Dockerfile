# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

# Copy and build shared contracts first
COPY frameforge-shared-contracts/package*.json ./frameforge-shared-contracts/
COPY frameforge-shared-contracts/tsconfig.json ./frameforge-shared-contracts/
COPY frameforge-shared-contracts/src ./frameforge-shared-contracts/src/

WORKDIR /build/frameforge-shared-contracts
RUN npm install && npm run build

# Copy auth service files
WORKDIR /build/frameforge-auth-service
COPY frameforge-auth-service/package*.json ./
COPY frameforge-auth-service/tsconfig.json ./

# Install dependencies (npm will resolve file:../frameforge-shared-contracts)
RUN npm install

# Copy source code
COPY frameforge-auth-service/src ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Copy built shared contracts
COPY --from=builder /build/frameforge-shared-contracts/package*.json ./frameforge-shared-contracts/
COPY --from=builder /build/frameforge-shared-contracts/dist ./frameforge-shared-contracts/dist/

# Set up auth service directory
WORKDIR /app/frameforge-auth-service
COPY frameforge-auth-service/package*.json ./

# Install only production dependencies
RUN npm install --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /build/frameforge-auth-service/dist ./dist

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
