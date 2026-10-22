# Multi-stage build: Next.js standalone server + a self-contained Prisma CLI for migrations.
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# Only the migration CLI and its own dependencies (kept out of the app bundle).
FROM base AS migrator
WORKDIR /migrator
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund prisma@6.19.3

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/.uploads && chown app:app /app/.uploads
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=migrator --chown=app:app /migrator/node_modules /migrator/node_modules
USER app
EXPOSE 3000
# Apply pending migrations, then start. Safe to run on every boot.
CMD ["sh", "-c", "node /migrator/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
