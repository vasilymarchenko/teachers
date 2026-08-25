---
id: T-002
type: ticket
title: Project scaffold — Next.js, Drizzle, Vitest, Postgres in Compose
status: todo
depends_on: []
refs:
  - docs/tech-stack.md
  - docs/architecture/architect-overview.md#2
---

## Goal

Stand up a runnable, feature-free skeleton matching the layer layout in overview
§2, so that everything after this ticket has somewhere to land and a way to run.

## Acceptance criteria

- [ ] Next.js 15 + TypeScript (App Router), Tailwind and shadcn/ui initialised.
- [ ] Drizzle + `drizzle-kit` configured against a `DATABASE_URL`; no schema yet.
- [ ] Vitest configured and running a trivial passing test.
- [ ] `docker-compose.yml` with a Postgres 16 service and a named volume;
      `.env.example` committed, `.env` ignored.
- [ ] better-auth installed and wired far enough to prove the connection; no
      sign-in screens.
- [ ] Directory skeleton from overview §2 created (`lib/domain`, `lib/db`,
      `lib/actions`, `lib/validation`, `lib/time`, `lib/auth`).
- [ ] `README.md` documents the local run: compose up, migrate, dev, test.
- [ ] `/init` re-run so the root `CLAUDE.md` carries real build/lint/test
      commands instead of the pre-code placeholder.

## Notes
