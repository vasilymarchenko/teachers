# Tech stack

**Next.js as fullstack.** Server Actions and Route Handlers give you a backend within the same project. Database model types flow directly into components, with no DTO layer. For a single-user app with a "one teacher" load, that's not a compromise — it's a fair economy. (One deliberate exception: the calendar consumes the *computed* result of `expand()`, not a table row — see `docs/architecture/architect-overview.md` §5.)

**Claude Code.** This is a practical argument, not a marketing one: on Next.js + Tailwind + shadcn/ui the model has radically more high-quality material to draw on than on a Blazor or ASP.NET+React stack. UI iterations will be noticeably faster and more accurate — and UI is the main body of work here.

**Drizzle instead of Prisma.** Prisma drags along a separate engine and eats a fair amount of memory; Drizzle is a thin layer over SQL, with syntax close to what you already know from EF Core. Migrations go through `drizzle-kit`.

**PostgreSQL, not SQLite.** SQLite would be technically sufficient for a single user, but you're deliberately laying the groundwork for a multi-user mode. Postgres in Docker uses ~80–120 MB of RAM — nothing on a CX23 — and you won't need to migrate later. The price paid: one more service in Compose and a backup job that SQLite would not have needed.

**A date library is not optional.** This is a calendar application: ISO weeks starting Monday, week parity, semester boundaries, "until the nearest holidays". Hand-rolling that on bare `Date` is the single most reliable way to ship date bugs. `date-fns` + `date-fns/locale/uk` (or `Temporal` once it is comfortably available) is part of the stack, not a detail.

**Printing starts with CSS, not with a headless browser.** The spec requires print-ready pages in the first release (§7), not server-generated files. A dedicated `/print/...` route with `@media print` gives that for free — the browser's own "Save as PDF" produces the file, and the image stays small. Server-side rendering (Puppeteer / `@react-pdf/renderer`) costs ~300–400 MB of image and real memory peaks on a CX23, and buys nothing until the app itself has to *produce and store* a file (email it, attach it, archive it). Deferred, not rejected: the print route consumes the same domain functions either way, so swapping the renderer later does not touch the model.

## Full stack

|Layer|Choice|
|---|---|
|Frontend + Backend|Next.js 15, TypeScript|
|Styling|Tailwind + shadcn/ui|
|ORM|Drizzle|
|Database|PostgreSQL 16 (Docker)|
|Auth|better-auth (simpler than Auth.js, multi-tenancy-ready out of the box)|
|Validation|Zod (form schemas + trust boundary in Server Actions)|
|Dates|`date-fns` (+ `uk` locale). No bare `Date` arithmetic in domain code|
|Tests|Vitest — unit tests for `lib/domain` (`expand`, `parity`, recurrence)|
|Printing|`@media print` on a dedicated `/print/...` route; server-side PDF deferred|
|Reverse proxy|Caddy (automatic TLS)|
|Deploy|Docker Compose + GitHub Actions → GHCR → `docker compose pull`|
|Migrations|`drizzle-kit migrate` as an explicit deploy step (one-shot service in Compose)|
|Backups|`pg_dump` on a schedule + off-site copy|
|Quality gate|ESLint + Prettier, run in CI alongside `vitest run`|

## Deliberately not in the first release

These are real future needs, but nothing in the MVP uses them, and listing them as "the stack" invites building against them too early.

|Layer|When it comes back|
|---|---|
|Background jobs (queue table + cron)|With the first feature that actually needs one — notifications (spec §6.3) or import (§10). When it does: a **separate `worker` service** in Compose (same image, different command), never a `node-cron` timer inside the web process — that one fires twice in dev and once per replica in production. Job pickup via `SELECT … FOR UPDATE SKIP LOCKED` or an advisory lock.|
|AI (`@anthropic-ai/sdk`, tool use for structured output)|Third queue (spec §2) — not discussed yet. Zod is already in the stack and doubles as the structured-output schema when the time comes.|
|Redis / BullMQ|Only if the queue table stops being enough — i.e. not on this project's horizon.|
