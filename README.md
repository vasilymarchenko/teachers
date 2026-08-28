# Teachers

A personal web diary for a school teacher who is also a class supervisor.

The teacher keeps two parallel schedules — the lessons they teach themselves, and the lessons happening in their own class — on top of a single calendar. The calendar handles the realities of a school year: configurable term and holiday dates, alternating odd/even weeks, per-day substitutions, and one-off events such as deadlines and holidays.

Ukrainian UI. Single user for now, multi-tenant later.

See [`docs/specs/specification.md`](docs/specs/specification.md) for the full product specification (in Ukrainian).

## Stack

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js 16, TypeScript (Server Actions and Route Handlers) |
| Styling | Tailwind + shadcn/ui |
| ORM | Drizzle (`drizzle-kit` for migrations) |
| Database | PostgreSQL 16 (Docker) |
| Auth | better-auth |
| Validation | Zod |
| Dates | `date-fns` (+ `uk` locale) |
| Tests | Vitest (unit tests for the schedule domain) |
| Printing | `@media print` on a `/print/...` route; server-side PDF deferred |
| Reverse proxy | Caddy (automatic TLS) |
| Deploy | Docker Compose + GitHub Actions → GHCR → `docker compose pull` |

Background jobs and AI are deliberately out of the first release — see the "Deliberately not in the first release" table in the stack doc.

Rationale for these choices: [`docs/tech-stack.md`](docs/tech-stack.md).
Application architecture: [`docs/architecture/architect-overview.md`](docs/architecture/architect-overview.md).

## Running it locally

Prerequisites: Node.js 22+, npm, and Docker (for Postgres).

```sh
cp .env.example .env          # then set BETTER_AUTH_SECRET: openssl rand -base64 32
npm install
docker compose up -d          # PostgreSQL 16 on localhost:5432
npm run db:migrate            # apply migrations (no migrations exist yet — T-004)
npm run dev                   # http://localhost:3000
```

`GET /api/health` reports whether the database connection is live.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run db:generate` | generate a migration from `lib/db/schema` |
| `npm run db:migrate` | apply migrations — also an explicit deploy step |
| `npm run db:studio` | Drizzle Studio |

## Layout

```
app/          App Router: pages, layouts, route handlers, /print views
components/   React components, including shadcn/ui wrappers
lib/
  actions/    Server Actions: requireUser -> Zod -> domain/db -> revalidate
  auth/       the authorisation boundary
  db/         Drizzle client, schema/ (one file per aggregate), queries/
  domain/     pure, DB-free logic: schedule expansion, parity, recurrence
  time/       the single source of "today", in Europe/Kyiv
  validation/ Zod schemas shared by forms and Server Actions
```

The reasoning behind this layout is in
[`docs/architecture/architect-overview.md`](docs/architecture/architect-overview.md) §2.

## Status

Scaffold stage — the skeleton runs, no features yet. Work is tracked in
[`docs/backlog/`](docs/backlog/README.md).
