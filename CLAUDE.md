# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is in the pre-code planning stage. Only `specs/tech-stack.md` exists so far — no application code, package.json, or commits yet. Re-run `/init` once the project scaffold and source files exist so this document can be expanded with real build/lint/test commands and architecture notes.

## Project

"Teachers" is a web app for a single teacher (with an eye toward eventually supporting multiple users/tenants). See `specs/tech-stack.md` for the full stack rationale.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js 15, TypeScript (fullstack via Server Actions and Route Handlers — no separate DTO layer, DB model types flow directly into components) |
| Styling | Tailwind + shadcn/ui |
| ORM | Drizzle (not Prisma — thinner, closer to EF Core-style SQL; migrations via `drizzle-kit`) |
| Database | PostgreSQL 16 (Docker) — chosen over SQLite because multi-user support is a planned future step |
| Auth | better-auth |
| Validation | Zod (also used as the schema for structured AI output) |
| AI | `@anthropic-ai/sdk`, using tool use for structured output |
| Background jobs | a queue table + `node-cron` (no BullMQ/Redis at this stage) |
| Reverse proxy | Caddy (automatic TLS) |
| Deploy | Docker Compose + GitHub Actions → GHCR → `docker compose pull` on the VPS |

## Language requirements

- All UI text must be in Ukrainian.
- All product-level specifications must be in Ukrainian.
- Technical documentation (design and architecture documentation, implementation plans)
- When responding to the user in chat: reply in Ukrainian if the user's prompt is in Ukrainian or Russian; reply in English if the user's prompt is in English.
