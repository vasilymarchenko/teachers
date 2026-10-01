---
id: ADR-020
title: Ship the account command as one bundled file in the runner image
status: accepted
date: 2026-10-01
ticket: T-039
---

## Context

`ADR-019` puts teacher-account management in `lib/auth/teachers.ts`, with a
console command as the only caller for now. That command has to run against the
deployed stack, and the VPS has nothing but Docker: no Node, no `npm`, no
TypeScript sources, and — after `ADR-003` — nothing is run from the checkout
there, which holds only the Compose file and the `Caddyfile`.

Two images are published per commit, at one `IMAGE_TAG`. `runner` is the output
of `next build` in standalone mode: `server.js`, plus the subset of
`node_modules` the server was traced to need. It has no `tsx`, no `@/` path
alias and no `lib/` sources. `migrator` has the full `node_modules`, dev
dependencies included, with `drizzle.config.ts`, `drizzle/` and `lib/db/schema`
copied in.

The command imports `lib/auth/teachers.ts`, and through it `lib/auth/auth.ts`,
`lib/db/client.ts` and the schema — the same modules the web process runs. Its
runtime dependencies are ones `runner` already has reasons to carry:
`better-auth`, `drizzle-orm`, `postgres`, `zod`.

Measured, not assumed: `esbuild` bundles `scripts/teacher/index.ts` into one
CommonJS file of about 2.5 MB whose only unresolved imports are Node built-ins
and `next/headers.js`. The last is a dynamic import inside better-auth's
`nextCookies()` plugin, taken after any call that sets a cookie — sign-up does.
Run from a directory with no `node_modules`, `create` fails on that import
*after* the account row is written; run from inside `runner`, where the
standalone output's own `next` resolves it, every subcommand works.

## Options

1. **One bundled file in `runner`**, built in the `builder` stage beside
   `next build` and run with `docker compose exec web node teacher.cjs`. No new
   image, no new Compose service, and the command is by construction the same
   commit as the web process it runs next to. Costs `esbuild` as a direct
   devDependency, about 2.5 MB in the production image, and a second copy of
   the auth and database modules inside that image — the bundle inlines them
   rather than sharing the server's.
2. **The `migrator` image**, with `tsx`, `lib/` and `scripts/teacher/` copied
   in, run through a second `tools` service. Needs no bundler. But `migrator`
   stops being the image that carries the schema and nothing else: it gains the
   application's auth code, `BETTER_AUTH_SECRET` in its environment, and a
   reason to be rebuilt on every change under `lib/`. `ADR-003` would have to
   be amended to say the migrator is a general operations image.
3. **A third published image** for operations. The cleanest separation and the
   most machinery: one more artifact to build, tag in step and pull, for five
   subcommands.

## Decision

Option 1.

- `npm run build:teacher` bundles `scripts/teacher/index.ts` to
  `dist/teacher.cjs` with `esbuild`: CommonJS, Node 22, everything inlined
  except `next`.
- The `builder` stage runs it after `npm run build`; `runner` copies the result
  to `/app/teacher.cjs`.
- On the VPS the command is
  `docker compose -f docker-compose.prod.yml exec web node teacher.cjs <subcommand>`.
  It runs in the `web` container, with that container's `DATABASE_URL`,
  `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, so a password it hashes is one
  that container's sign-in verifies.
- `next` stays external. The file is not a standalone program: it runs inside
  `runner`, and `ci.yml`'s `images` job proves that on the image it built —
  create, list, deactivate, activate, set a password, and two refusals — against
  the database the migrator image has just migrated.

**This is not the case `ADR-003` option 2 rejected.** That option was turned
down for two things: it would put a devDependency and a config file the running
application never uses into the production image, and it would put the ability
to migrate next to the process that must never migrate its own database.
Neither holds here. Nothing in the bundle is a devDependency at run time —
`esbuild` builds it and stays in `builder`, and the entry point reads a
developer's `.env` with Node's own `process.loadEnvFile()` rather than with
`dotenv`, which is a devDependency the bundle would otherwise inline. And
account management is not a
capability the web process is forbidden: `ADR-019` expects a Server Action to
become the second caller of the same functions. `ADR-003` stands unchanged.

## Consequences

`exec` needs a running `web` container, so on a first deploy the first teacher
is created after `up -d`, not before it; until then the site serves a sign-in
page nobody can pass, which is harmless.

The bundle is a second build of `lib/auth` and `lib/db` beside the server's. They
are built from the same commit in the same stage, so they cannot disagree about
the schema or the hook; what they do not share is a process, so the command
opens its own database connections and closes them on exit.

`dist/teacher.cjs` depends on `runner` keeping `next` resolvable from `/app`. If
the standalone output ever stops shipping it there, `create` breaks after the
row is written and before the password is printed — which is why the CI step
runs `create` first and on the built image, not under `tsx`.

`npm` and `tsx` remain the way the command runs on a developer's machine
(`npm run teacher -- …`); the bundle is built only in the image and in whoever
runs `npm run build:teacher` by hand.

Revisit when an admin page exists and covers these operations: the console then
has one job left — creating the first account — and may be worth replacing with
something smaller. Revisit also if a second operations command appears; two
bundles in `runner` is the point at which option 3 starts paying for itself.
