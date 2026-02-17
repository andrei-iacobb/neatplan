# Use Node.js Alpine Linux image
FROM node:20-alpine

# Add necessary packages for Prisma and database tools
RUN apk add --no-cache libc6-compat openssl postgresql-client

# Create a non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY --chown=nextjs:nodejs . .

# Generate Prisma client for the correct platform
RUN npx prisma generate

# Build the Next.js app for production startup
RUN npm run build:no-lint

# Set environment variables - use production by default
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a startup script to handle database migration and startup
COPY --chown=nextjs:nodejs start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Switch to non-root user
USER nextjs

EXPOSE 4040

# Use startup script
CMD ["/usr/local/bin/start.sh"]
