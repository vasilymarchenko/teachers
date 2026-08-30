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
npm run db:migrate            # apply migrations
npm run db:seed               # optional: the demo teacher and the fixture scenario
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
| `npm test` | Vitest — the unit suite, once |
| `npm run test:watch` | the unit suite, watching |
| `npm run test:integration` | the tests that need a migrated Postgres (see below) |
| `npm run db:generate` | generate a migration from `lib/db/schema` |
| `npm run db:migrate` | apply migrations — also an explicit deploy step |
| `npm run db:seed` | reset the demo teacher and re-insert the fixture scenario |
| `npm run db:studio` | Drizzle Studio |

### Migrations

`npm run db:migrate` (`drizzle-kit migrate`) is **an explicit deploy step**, not
something the application does at start-up: the web process never migrates its
own database. That is true locally (`npm run db:migrate`, above) and on the VPS
(the `migrate` Compose service) alike — see "Deploying to the VPS" below for
the production procedure.

Two of the migration files in `drizzle/` are written by hand rather than
generated, because `drizzle-kit` cannot express what they contain:

| File | Why it is hand-written |
|---|---|
| `0000_btree_gist.sql` | `CREATE EXTENSION btree_gist` — needed before 0002, which compares a `text` and an enum column with `=` inside a GiST index |
| `0002_exclusion_constraints.sql` | the three `EXCLUDE USING gist` constraints that keep academic years, semesters and template versions from overlapping |

Their statements are invisible to the snapshot in `drizzle/meta`, so a future
generated migration that recreates one of those tables would silently drop its
exclusion constraint. `docs/architecture/design/schema.md` §9 is the record.

`CREATE EXTENSION` needs a role with `CREATE` on the database. The Compose
`postgres` role has it; on a managed host, `btree_gist` must be on the
provider's allow-list.

### Tests

`npm test` is pure and DB-free. `npm run test:integration` runs the
`*.integration.test.ts` files, which assert what the database itself enforces —
the exclusion constraint above exists only in SQL, and a mock of it would be
asserting the mock. They need `DATABASE_URL` pointing at a **migrated**
database, and they create and delete their own `user` rows rather than touching
the seeded teacher.

### Demo data

`npm run db:seed` creates the demo teacher (`SEED_USER_EMAIL` /
`SEED_USER_PASSWORD` from `.env`, with a development default) through
better-auth's own API, then inserts the scenario of
`docs/architecture/design/expand-fixtures.md` §3 — an academic year, its
semesters, holidays, bells, parity anchors, four template versions with 44 slots
between them, and eight day overrides. It deletes that user and everything
cascading from them first, so running it twice leaves the same database, and it
refuses to run with `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=1`.

## Deploying to the VPS

Prerequisites on the VPS: Docker Engine with the Compose plugin (`docker compose`,
not the standalone `docker-compose`), and a domain name pointed at the VPS's
public IP — Caddy's automatic TLS needs that to request a certificate. Only
ports 80 and 443 need to be open; Postgres stays on the Compose-internal
network.

```sh
git clone git@github.com:vasilymarchenko/teachers.git && cd teachers
cp .env.example .env    # set POSTGRES_*, BETTER_AUTH_SECRET, CADDY_DOMAIN, CADDY_EMAIL
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

`migrate` runs `drizzle-kit migrate` once and exits — it is not one of the
services `up -d` starts. It is its own published image
(`ghcr.io/vasilymarchenko/teachers-migrator`, ADR-003), pulled like `web` and
never built on the VPS, and it always deploys at the same `IMAGE_TAG` as `web`
so the schema a release expects and the code that runs against it can never
drift apart.

### Redeploying and rolling back

`docker-compose.prod.yml`'s header comment holds the three-command sequence —
repeat it for every redeploy: `git pull` first if `docker-compose.prod.yml` or
`Caddyfile` changed (they are read from the checkout, not the image), then the
three commands above, in the same order — `migrate` before `up -d`, every time,
even when this deploy added no new migration.

To roll back, set `IMAGE_TAG` in `.env` to a previous `sha-<short-sha>` (GitHub
Actions publishes one for both images on every push to `main`, alongside
`latest`) and repeat `pull` + `migrate` + `up -d`. A rollback across a migration
that changed the schema also needs the matching down step run by hand — there
is no automated down migration.

### Backups

```sh
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "teachers-$(date +%F).sql.gz"
```

`sh -c '...'` in single quotes, not a bare `pg_dump -U "$POSTGRES_USER" ...`:
`POSTGRES_USER`/`POSTGRES_DB` are set inside the `db` container by Compose, not
in the host shell that runs this command, so an unquoted `$POSTGRES_USER` here
expands to an empty string on the host before Docker ever sees it.

Copy the result off the VPS (`scp`/`rsync` to another host) — a backup that
lives on the same disk as the database survives no disk failure. A daily cron
entry on the VPS:

```
0 3 * * * cd /path/to/teachers && docker compose -f docker-compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > /var/backups/teachers/teachers-$(date +\%F).sql.gz
```

## Layout

```
app/          App Router: pages, layouts, route handlers, /print views
components/   React components, including shadcn/ui wrappers
drizzle/      migrations and their drizzle-kit snapshots, all committed
lib/
  actions/    Server Actions: requireUser -> Zod -> domain/db -> revalidate
  auth/       the authorisation boundary
  db/         Drizzle client, schema/ (one file per aggregate), queries/
  domain/     pure, DB-free logic: schedule expansion, parity, recurrence
  time/       the single source of "today", in Europe/Kyiv
  validation/ Zod schemas shared by forms and Server Actions
scripts/      one-off scripts run through npm, e.g. the demo seed
```

The reasoning behind this layout is in
[`docs/architecture/architect-overview.md`](docs/architecture/architect-overview.md) §2.

## Status

Early stage: the skeleton runs and the database schema is in place, but there
are no screens yet. Work is tracked in
[`docs/backlog/`](docs/backlog/README.md).
