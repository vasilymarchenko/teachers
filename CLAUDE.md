# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is in the pre-code planning stage — no application code, package.json, or scaffold yet. The planning documents are:

- `docs/specs/specification.md` — product specification (Ukrainian), the primary document
- `docs/tech-stack.md` — stack and its rationale
- `docs/architecture/architect-overview.md` — application architecture: data model, layers, trade-offs (§9) and open questions (§10)
- `docs/architecture/glossary.md` — binds each Ukrainian product term to its English identifier; new domain terms go there first
- `docs/backlog/` — the work tracker: one file per ticket (`T-NNN`) and per open question (`Q-NNN`), index in `docs/backlog/README.md`, conventions in `docs/backlog/CLAUDE.md`. There is no external tracker; a ticket states what to do and when it is done, and references the architecture document rather than restating it

Re-run `/init` once the project scaffold and source files exist so this document can be expanded with real build/lint/test commands.

## Project

"Teachers" is a web app for a single teacher (with an eye toward eventually supporting multiple users/tenants). See `docs/tech-stack.md` for the full stack rationale.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js 15, TypeScript (fullstack via Server Actions and Route Handlers — no separate DTO layer, DB model types flow directly into components) |
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
- the backlog — `docs/backlog/**`;
- detailed design documents, ADRs, implementation plans, `docs/tech-stack.md`, `README.md`.

**Architecture (the bridge between the two) — `docs/architecture/*.md`, i.e. `architect-overview.md` and `glossary.md`:**
- written in **Ukrainian prose with English nouns**: the narrative, reasoning and trade-offs are Ukrainian, but every technical entity keeps its English name verbatim — table, type and field names, file paths, layer names, library names, code blocks. Never translate an identifier into Ukrainian; a translated term is exactly where the document loses its link to the code.
- Rationale: these documents explain *why* the product requirements produce this structure, so they constantly reference the Ukrainian specification.
- **Exception — `docs/architecture/design/**` is English.** That subtree holds the detailed design documents from the English list above (schema notes, ADRs, golden fixtures, implementation plans). It sits under `docs/architecture/` because it belongs to the same body of work, not because it follows the same language rule: it states mechanics for a developer, not reasoning for a reader of the specification. Ukrainian appears there only inside data a teacher would read — subject names, class names, demo payloads.

**Never keep the same document in two languages.** Documents are split by **level of detail, not by language**:
- `docs/architecture/architect-overview.md` (Ukrainian) — decisions, module boundaries, trade-offs, open questions;
- detailed design docs / ADRs / implementation plans (English) — mechanics: schema, indexes, signatures, migration order.

A detailed document does not restate the overview — it references the relevant section of it. Every fact lives in exactly one place, in exactly one language.

**Glossary.** `docs/architecture/glossary.md` is the single place binding a Ukrainian product term to its English identifier (`заміна → DayOverride.kind = SUBSTITUTION`, `розгорнутий урок → ResolvedLesson`). A new domain term goes there first, then into the code and the documents.

**Chat replies:** Ukrainian if the user's prompt is in Ukrainian or Russian; English if the prompt is in English.
