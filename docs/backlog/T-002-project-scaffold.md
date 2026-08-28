---
id: T-002
type: ticket
title: Project scaffold — Next.js, Drizzle, Vitest, Postgres in Compose
status: done
depends_on: []
refs:
  - docs/tech-stack.md
  - docs/architecture/architect-overview.md §2
---

## Goal

Stand up a runnable, feature-free skeleton matching the layer layout in overview
§2, so that everything after this ticket has somewhere to land and a way to run.

## Acceptance criteria

- [x] Next.js 16 + TypeScript (App Router), Tailwind and shadcn/ui initialised.
- [x] Drizzle + `drizzle-kit` configured against a `DATABASE_URL`; no schema yet.
- [x] Vitest configured and running a trivial passing test.
- [x] `docker-compose.yml` with a Postgres 16 service and a named volume;
      `.env.example` committed, `.env` ignored.
- [x] better-auth installed and wired far enough to prove the connection; no
      sign-in screens.
- [x] Directory skeleton from overview §2 created (`lib/domain`, `lib/db`,
      `lib/actions`, `lib/validation`, `lib/time`, `lib/auth`).
- [x] `README.md` documents the local run: compose up, migrate, dev, test.
- [x] `/init` re-run so the root `CLAUDE.md` carries real build/lint/test
      commands instead of the pre-code placeholder.

## Notes

- **Next.js 16, not 15.** 15 was the current release when `tech-stack.md` was
  written; 16 is current now, and starting one major behind would mean an
  upgrade before the first feature. `tech-stack.md`, `README.md`, the root
  `CLAUDE.md` and this ticket were updated in the same commit.
- **Package manager: npm.** `package-lock.json` is committed; T-015 builds on it.
- **shadcn/ui initialised by hand.** `ui.shadcn.com` is unreachable from the
  environment this was built in, so `components.json`, `cn()`, the neutral CSS
  variable theme and `components/ui/button.tsx` were written directly. The CLI
  works normally against this configuration from a machine that can reach the
  registry.
- **better-auth wiring.** `lib/auth/auth.ts` builds the instance over the
  Drizzle adapter and `app/api/auth/[...all]/route.ts` mounts it. It has no
  tables yet — those come with `requireUser()` and the sign-in flow in T-006.
- **`getDb()` and `getAuth()` are lazy.** `next build` and the unit tests load
  these modules without a database; a connection opened at import time would
  make both depend on `DATABASE_URL`.
- **`GET /api/health`** exists to make "the connection works" checkable rather
  than assumed: it runs `select 1` through Drizzle and reports where better-auth
  is mounted. Verified against a real PostgreSQL 16 — `{"database":"up"}` — with
  `/api/auth/get-session` answering `200`.
- **`lib/time/today.ts` landed here rather than in T-005.** The scaffold needed
  something real to test, and this is the one function every later ticket
  depends on. T-005 keeps `parity`, `calendarRules`, `boundaries` and `expand`.
- `drizzle-kit` pulls a transitive `esbuild` advisory (dev-only, moderate);
  the fix is a downgrade to `drizzle-kit@0.18`, which is not worth taking.
