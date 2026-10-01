# Multi-stage build. `runner` ships the app; `migrator` ships the one-shot
# `drizzle-kit migrate` deploy step (ADR-003) — it needs drizzle-kit and
# drizzle.config.ts, both dropped from `runner`, but does not need `next
# build`, so it does not go through `builder`. `runner` also carries the
# account command as one bundled file, `teacher.cjs` (ADR-020).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY lib/db/schema ./lib/db/schema
CMD ["npx", "drizzle-kit", "migrate"]

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# One file with every dependency inlined but `next`, which the standalone
# output beside it already has (ADR-020).
RUN npm run build:teacher

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `docker compose exec web node teacher.cjs <subcommand>` — README, "Teacher
# accounts".
COPY --from=builder --chown=nextjs:nodejs /app/dist/teacher.cjs ./teacher.cjs

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
