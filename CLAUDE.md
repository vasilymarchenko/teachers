# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The scaffold (T-002), the database schema (T-004), the schedule domain (T-005), the auth boundary (T-006), the calendar read queries (T-008), the calendar read views (T-007), the application shell (T-014), the deploy pipeline (T-015) and the year-setup screens (T-009) are in place: the app builds and runs against a migrated Postgres, behind sign-in, with the navigation panel, a working calendar — day, week, month and year over real schedule data — and a `/year` screen the teacher enters that data on, while the schedule and event screens of the first release are still placeholders; it is deployable to a VPS via Docker Compose, GHCR and Caddy. The first writes landed with T-009: `lib/db/queries` stays read-only and every mutation is a Server Action in `lib/actions` going to Drizzle directly, which is what `architect-overview.md` §2 prescribes for CRUD forms. The weekly template, day overrides and events are still read-only. The planning documents are:

- `docs/specs/specification.md` — product specification (Ukrainian), the primary document
- `docs/tech-stack.md` — stack and its rationale
- `docs/architecture/architect-overview.md` — application architecture: data model, layers, trade-offs (§9) and open questions (§10)
- `docs/architecture/glossary.md` — binds each Ukrainian product term to its English identifier; new domain terms go there first
- `docs/architecture/decisions/` — ADRs: one file per significant decision, English, dated and immutable. An ADR records *why* a decision was taken, which alternatives were rejected and at what cost; `architect-overview.md` states what is true **now** and links to the ADR instead of re-arguing it. Write one when a decision changes the data model or a contract other tickets are written against, chooses between real alternatives with a lasting cost, or would otherwise have to be reverse-engineered from the code — not for every ticket. Conventions and the template: `docs/architecture/decisions/README.md`
- `docs/backlog/` — the work tracker: one file per ticket (`T-NNN`) and per open question (`Q-NNN`), index in `docs/backlog/README.md`, conventions in `docs/backlog/CLAUDE.md`. There is no external tracker; a ticket states what to do and when it is done, and references the architecture document rather than restating it

## Commands

Package manager: **npm** (`package-lock.json` is committed). Node.js 22+.

```sh
npm run dev          # dev server on :3000
npm run build        # production build
npm start            # serve the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest, the unit suite, once
npm run test:watch   # the unit suite, watching
npm run test:integration  # the *.integration.test.ts files — needs a migrated Postgres
npm run db:generate  # drizzle-kit generate — migration from lib/db/schema
npm run db:migrate   # drizzle-kit migrate — also an explicit deploy step
npm run db:seed      # reset the demo teacher and re-insert the fixture scenario
npm run db:studio    # Drizzle Studio
```

Postgres runs from `docker-compose.yml` (`docker compose up -d`). Copy `.env.example` to `.env` first; `DATABASE_URL` must agree with the `POSTGRES_*` values in the same file. `docker-compose.yml` is dev-only; the production stack (web, Postgres, Caddy) is `docker-compose.prod.yml`, deployed as described in `README.md` ("Deploying to the VPS").

Before pushing, run `npm run lint && npm run typecheck && npm test`. A single test file: `npx vitest run lib/time/today.test.ts`. The integration suite is separate because it needs a live database — run it too when touching `lib/db`.

## Code layout

`app/` is the App Router; `components/` holds React and shadcn/ui wrappers; `lib/` is split into `domain/` (pure, DB-free logic — the tested part), `db/` (Drizzle client, `schema/` one file per aggregate, `queries/`), `actions/` (Server Actions), `validation/` (Zod), `auth/` and `time/`. The reasoning is in `docs/architecture/architect-overview.md` §2 — that document, not this one, is the place to change the layout.

Two rules from the architecture that are easy to violate silently:

- **No `new Date()` in domain code.** "Today" comes only from `lib/time/today.ts`, which resolves the date in `Europe/Kyiv` (§8.5). The container runs in UTC; a naive `new Date()` is a day off for three hours every night.
- **`userId` is the first argument** of every function in `lib/db/queries` and of every mutation, and it is only ever obtained from `requireUser()` — never from form or request input (§8.4).

## Project

"Teachers" is a web app for a single teacher (with an eye toward eventually supporting multiple users/tenants). See `docs/tech-stack.md` for the full stack rationale.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js 16, TypeScript (fullstack via Server Actions and Route Handlers — no separate DTO layer, DB model types flow directly into components) |
| Styling | Tailwind + shadcn/ui |
| ORM | Drizzle (not Prisma — thinner, closer to EF Core-style SQL; migrations via `drizzle-kit`) |
| Database | PostgreSQL 16 (Docker) — chosen over SQLite because multi-user support is a planned future step |
| Auth | better-auth |
| Validation | Zod (also used as the schema for structured AI output) |
| Dates | `date-fns` (+ `uk` locale) — no bare `Date` arithmetic in domain code |
| Tests | Vitest — unit tests for `lib/domain` (`expand`, `parity`) |
| Printing | `@media print` on a `/print/...` route; server-side PDF deferred until the app must produce a file itself |
| Reverse proxy | Caddy (automatic TLS) |
| Deploy | Docker Compose + GitHub Actions → GHCR → `docker compose pull` on the VPS; `drizzle-kit migrate` as an explicit deploy step |

Deliberately **not** in the first release: background jobs (queue table + cron) and AI (`@anthropic-ai/sdk`). When jobs are needed, they run as a separate `worker` service in Compose — never a `node-cron` timer inside the web process.

## Language requirements

Language is chosen by **audience**, not by file type. If a teacher could read the text — Ukrainian; if only a developer will — English.

**Ukrainian (product level — the teacher reads it):**
- all UI text, user-facing error messages, notifications, seed/demo data;
- product specifications — `docs/specs/**`;
- must be understandable to a Ukrainian-speaking teacher with no technical background: no untranslated technical jargon, no code identifiers in the prose.

**English (technical level — only developers read it):**
- code, identifiers, code comments, commit messages, PR descriptions;
- the backlog — `docs/backlog/**`, and the agent tooling — `.claude/**`;
- detailed design documents, ADRs, implementation plans, `docs/tech-stack.md`, `README.md`.

**Architecture (the bridge between the two) — `docs/architecture/*.md`, i.e. `architect-overview.md` and `glossary.md`:**
- written in **Ukrainian prose with English nouns**: the narrative, reasoning and trade-offs are Ukrainian, but every technical entity keeps its English name verbatim — table, type and field names, file paths, layer names, library names, code blocks. Never translate an identifier into Ukrainian; a translated term is exactly where the document loses its link to the code.
- Rationale: these documents explain *why* the product requirements produce this structure, so they constantly reference the Ukrainian specification.
- **Exception — `docs/architecture/design/**` and `docs/architecture/decisions/**` are English.** These two subtrees hold the detailed documents from the English list above: `design/` states mechanics (schema notes, golden fixtures, implementation plans), `decisions/` records why a choice was made and what was rejected. They sit under `docs/architecture/` because they belong to the same body of work, not because they follow the same language rule — the language rule follows the audience, and the audience for both is a developer, not a reader of the specification. Note that this puts *reasoning* in English in `decisions/` while `architect-overview.md` reasons in Ukrainian: the overview argues from the product requirements a teacher stated, an ADR argues between technical options only. Ukrainian appears in either subtree only inside data a teacher would read — subject names, class names, demo payloads.

**Never keep the same document in two languages.** Documents are split by **level of detail, not by language**:
- `docs/architecture/architect-overview.md` (Ukrainian) — decisions, module boundaries, trade-offs, open questions;
- detailed design docs / ADRs / implementation plans (English) — mechanics: schema, indexes, signatures, migration order.

A detailed document does not restate the overview — it references the relevant section of it. Every fact lives in exactly one place, in exactly one language.

**Glossary.** `docs/architecture/glossary.md` is the single place binding a Ukrainian product term to its English identifier (`заміна → DayOverride.kind = SUBSTITUTION`, `розгорнутий урок → ResolvedLesson`). A new domain term goes there first, then into the code and the documents.

**Chat replies:** Ukrainian if the user's prompt is in Ukrainian or Russian; English if the prompt is in English.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
