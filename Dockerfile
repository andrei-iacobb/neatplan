# Use Node.js Alpine Linux image
FROM node:20-alpine

# Add necessary packages for Prisma and database tools
# pnpm is pinned deliberately, to the last 10.x. An unpinned `npm install -g pnpm`
# silently moved to 11 between builds and broke an image whose application code had not
# changed: pnpm 11 requires node:sqlite, which does not exist on Node 20, so the install
# died with ERR_UNKNOWN_BUILTIN_MODULE. Pinning the build tool rather than bumping the
# runtime keeps this a build-time change with no new Node major under a live service.
# If Node is ever moved to 22+, pnpm 11 becomes available again.
RUN apk add --no-cache libc6-compat openssl postgresql-client && \
    npm install -g pnpm@10.34.5

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
