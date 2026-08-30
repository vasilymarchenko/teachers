---
id: T-015
type: ticket
title: Deploy pipeline — GHCR image, Compose on the VPS, Caddy, migrations
status: done
depends_on: [T-002, T-004]
refs:
  - docs/tech-stack.md
  - docs/architecture/architect-overview.md §8.4
---

## Goal

Make the application deployable to the VPS by the route tech-stack.md fixes:
GitHub Actions builds an image to GHCR, the VPS pulls it with Compose, Caddy
terminates TLS, and migrations run as an explicit step.

## Acceptance criteria

- [x] Multi-stage `Dockerfile` producing a Next.js standalone image.
- [x] GitHub Actions workflow: build and push to GHCR on the default branch.
- [x] Production `docker-compose.yml`: web, Postgres 16, Caddy; named volumes
      for database and Caddy state.
- [x] Caddyfile with automatic TLS for the production hostname.
- [x] `drizzle-kit migrate` runs as its own deploy step, never on web start.
- [x] Secrets and `DATABASE_URL` supplied by environment, nothing committed;
      `.env.example` covers every variable the compose file reads.
- [x] Postgres backup command documented (overview §9 names backup as the
      accepted cost of choosing Postgres).
- [x] Deploy and rollback procedure written up in `README.md`.

## Notes

- The production compose file is `docker-compose.prod.yml`, kept separate from
  the root `docker-compose.yml` (Postgres only, for local dev).
- `migrate` is a one-shot service under the `tools` profile, built from the
  Dockerfile's `builder` stage (it needs drizzle-kit and `drizzle.config.ts`,
  neither of which the published `runner` image carries) — never pulled from
  GHCR, and never part of `docker compose up`.
- Backups and the deploy/rollback procedure are documented in `README.md`
  ("Deploying to the VPS") rather than automated — no scheduler beyond the VPS's
  own cron, consistent with background jobs being out of scope for the first
  release (tech-stack.md).
- Follow-up, out of scope here: `docs/tech-stack.md`'s "Quality gate" row
  (ESLint + Prettier + `vitest run` in CI) has no workflow yet — this ticket
  only covers the image build and publish.
