---
id: T-015
type: ticket
title: Deploy pipeline — GHCR image, Compose on the VPS, Caddy, migrations
status: todo
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

- [ ] Multi-stage `Dockerfile` producing a Next.js standalone image.
- [ ] GitHub Actions workflow: build and push to GHCR on the default branch.
- [ ] Production `docker-compose.yml`: web, Postgres 16, Caddy; named volumes
      for database and Caddy state.
- [ ] Caddyfile with automatic TLS for the production hostname.
- [ ] `drizzle-kit migrate` runs as its own deploy step, never on web start.
- [ ] Secrets and `DATABASE_URL` supplied by environment, nothing committed;
      `.env.example` covers every variable the compose file reads.
- [ ] Postgres backup command documented (overview §9 names backup as the
      accepted cost of choosing Postgres).
- [ ] Deploy and rollback procedure written up in `README.md`.

## Notes
