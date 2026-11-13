# syntax=docker/dockerfile:1

# ---- deps: install ALL dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---- build: compile Next.js standalone ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BETTER_AUTH_SECRET="build-dummy-secret-32-chars-long-prod"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_OUTPUT="standalone"
RUN --mount=type=cache,target=/app/.next/cache \
    pnpm exec next build

# ---- runtime: lean production image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
WORKDIR /app

# Install postgresql-client for pg_dump and psql backups
RUN apk add --no-cache postgresql-client

# Copy the Next.js standalone output
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Copy migrations, schema, scripts, and runtime modules
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules

USER node
EXPOSE 3000

# Execute idempotent migrations then launch standalone server
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
