# Teachers

A personal web diary for a school teacher who is also a class supervisor.

The teacher keeps two parallel schedules — the lessons they teach themselves, and the lessons happening in their own class — on top of a single calendar. The calendar handles the realities of a school year: configurable term and holiday dates, alternating odd/even weeks, per-day substitutions, and one-off events such as deadlines and holidays.

Ukrainian UI. Single user for now, multi-tenant later.

See [`specs/specification.md`](specs/specification.md) for the full product specification (in Ukrainian).

## Planned stack

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js 15, TypeScript (Server Actions and Route Handlers) |
| Styling | Tailwind + shadcn/ui |
| ORM | Drizzle (`drizzle-kit` for migrations) |
| Database | PostgreSQL 16 (Docker) |
| Auth | better-auth |
| Validation | Zod |
| AI | `@anthropic-ai/sdk`, tool use for structured output |
| Background jobs | queue table + `node-cron` |
| Reverse proxy | Caddy (automatic TLS) |
| Deploy | Docker Compose + GitHub Actions → GHCR → `docker compose pull` |

Rationale for these choices: [`specs/tech-stack.md`](specs/tech-stack.md).

## Status

Planning stage — no application code yet.
