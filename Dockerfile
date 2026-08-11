# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.19.0

FROM node:${NODE_VERSION}-bookworm-slim AS build-base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global corepack@0.35.0 \
  && corepack enable \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nextjs

FROM build-base AS dependencies

# Prisma 7 loads its datasource config during the package postinstall. This URL is
# deliberately non-secret and exists only in build stages; production receives its URL
# at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma

RUN --mount=type=cache,id=neatplan-pnpm,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG NEXT_PUBLIC_APP_BASE_URL=http://localhost:4040
ARG NEXTAUTH_URL=http://localhost:4040
ARG CORS_ALLOWED_ORIGIN=http://localhost:4040
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    CORS_ALLOWED_ORIGIN=${CORS_ALLOWED_ORIGIN}
COPY . .

# Generate after the complete Prisma configuration is present, then let Next produce
# the traced standalone server and Linux-native Prisma/Sharp artifacts.
RUN pnpm exec prisma generate \
  && pnpm build

FROM build-base AS migrator

ENV NODE_ENV=production \
  HOME=/tmp \
  XDG_CACHE_HOME=/tmp/.cache

COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chmod=0555 start.sh /usr/local/bin/neatplan-entrypoint

USER nextjs
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/neatplan-entrypoint"]
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-bookworm-slim AS runner

ARG APP_GIT_SHA=unknown
ARG APP_GIT_BRANCH=unknown

LABEL org.opencontainers.image.source="https://github.com/andrei-iacobb/neatplan" \
  org.opencontainers.image.revision="${APP_GIT_SHA}"

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=4040 \
  HOME=/tmp \
  XDG_CACHE_HOME=/tmp/.cache \
  TESSERACT_PATH=/usr/bin/tesseract \
  TESSERACT_LANG=eng \
  NEATPLAN_DATA_DIR=/app/data \
  NEATPLAN_APP_SERVER=1 \
  APP_GIT_SHA=${APP_GIT_SHA} \
  APP_GIT_BRANCH=${APP_GIT_BRANCH}

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    dumb-init \
    tesseract-ocr \
    tesseract-ocr-eng \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --chmod=0555 start.sh /usr/local/bin/neatplan-entrypoint

RUN mkdir -p /app/data/document-jobs /app/.next/cache \
  && chown -R nextjs:nodejs /app/data /app/.next/cache

USER nextjs
EXPOSE 4040
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4040/api/readyz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/neatplan-entrypoint"]
CMD ["node", "server.js"]
