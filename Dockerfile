# Use Node.js Alpine Linux image
FROM node:20-alpine

# Add necessary packages for Prisma and database tools
# pnpm is pinned deliberately. An unpinned `npm install -g pnpm` silently moved from 10
# to 11 between builds, and 11 changed how install scripts are approved - a green build
# in July failed in July on identical application code.
RUN apk add --no-cache libc6-compat openssl postgresql-client && \
    npm install -g pnpm@11.17.0

# Create a non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

WORKDIR /app

# Copy package files
# pnpm-workspace.yaml carries onlyBuiltDependencies. Without it in the build context
# pnpm ignores the postinstall scripts for prisma, sharp and esbuild and then fails the
# install outright with ERR_PNPM_IGNORED_BUILDS.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY --chown=nextjs:nodejs . .

# Generate Prisma client for the correct platform
RUN pnpm exec prisma generate

# Build the Next.js app for production startup
RUN pnpm run build:no-lint

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
