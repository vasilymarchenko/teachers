**Next.js as fullstack.** Server Actions and Route Handlers give you a backend within the same project. Database model types flow directly into components, with no DTO layer. For a single-user app with a "one teacher" load, that's not a compromise — it's a fair economy.

**Claude Code.** This is a practical argument, not a marketing one: on Next.js + Tailwind + shadcn/ui the model has radically more high-quality material to draw on than on a Blazor or ASP.NET+React stack. UI iterations will be noticeably faster and more accurate — and UI is the main body of work here.

**Drizzle instead of Prisma.** Prisma drags along a separate engine and eats a fair amount of memory; Drizzle is a thin layer over SQL, with syntax close to what you already know from EF Core. Migrations go through `drizzle-kit`.

**PostgreSQL, not SQLite.** SQLite would be technically sufficient for a single user, but you're deliberately laying the groundwork for a multi-user mode. Postgres in Docker uses ~80–120 MB of RAM — nothing on a CX23 — and you won't need to migrate later.

## Full stack

|Layer|Choice|
|---|---|
|Frontend + Backend|Next.js 15, TypeScript|
|Styling|Tailwind + shadcn/ui|
|ORM|Drizzle|
|Database|PostgreSQL 16 (Docker)|
|Auth|better-auth (simpler than Auth.js, multi-tenancy-ready out of the box)|
|Validation|Zod (also used as the schema for structured output from AI)|
|AI|`@anthropic-ai/sdk`, tool use for structured output|
|Background jobs|a queue table + `node-cron`. BullMQ/Redis would be an unnecessary entity at this stage|
|Reverse proxy|Caddy (automatic TLS)|
|Deploy|Docker Compose + GitHub Actions → GHCR → `docker compose pull`|

