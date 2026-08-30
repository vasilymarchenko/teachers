---
id: ADR-003
title: Migrations run from a separately published image, not a VPS build
status: accepted
date: 2026-08-30
ticket: T-015
---

## Context

`drizzle-kit migrate` (§8.5 of `docs/tech-stack.md`'s table: "one-shot service
in Compose") needs `drizzle-kit` and `drizzle.config.ts`, neither of which the
application's `runner` image carries — `next build`'s standalone output only
bundles what `next start` needs. The `migrate` Compose service needs its own
image, built from a stage that has the full `node_modules` (including
devDependencies) and the repository's `drizzle.config.ts` and `drizzle/`
folder.

The first version of this pipeline pointed `migrate` at `build: {context: .,
target: builder}` — the same stage that produces the app before `next build`
strips it down — so `docker compose run --rm migrate` built the image locally
on the VPS on first use. That contradicts the deploy shape `docs/tech-stack.md`
fixes ("Docker Compose + GitHub Actions → GHCR → `docker compose pull`"): the
VPS pulls, it does not build. It also runs a full `next build` on the VPS
purely to obtain `drizzle-kit`, and — because the image is cached after the
first build — a second deploy's `migrate` step reuses whatever commit was
checked out on the VPS when that first image was built, not the commit the
`web` image being deployed was built from. A deploy that updates `web` without
also updating the VPS's git checkout applies the *old* schema, silently.

## Options

1. **Build `migrate` on the VPS from the `builder` stage** (the rejected first
   version). Costs a full `next build` per deploy and ties the migration to
   the VPS's git checkout rather than to the image being deployed — the
   staleness failure above.
2. **Ship `drizzle-kit` and `drizzle.config.ts` in the `runner` image** and run
   migrations from it. Keeps everything to one image, but permanently grows
   the production image with a devDependency and a config file the running
   application never uses, and blurs "the web process never migrates its own
   database" (`README.md`) — the capability would sit right next to the
   process that must not use it.
3. **Publish a second image, `teachers-migrator`, from a dedicated Dockerfile
   stage that skips `next build` entirely**, tagged by the same GitHub Actions
   workflow with the same scheme as `teachers`. Adds one more artifact to
   publish and keep tagged in step with the app image, but removes the VPS
   build, keeps `runner` minimal, and — tagged together — ties a migration
   image and an app image to the same commit by construction.

## Decision

Option 3. `Dockerfile` gets a `migrator` stage, built from `deps` (not from
`builder`, so it never runs `next build`) with just `package.json`,
`drizzle.config.ts`, `drizzle/` and `lib/db/schema` copied in.
`.github/workflows/docker-publish.yml` builds and pushes it as
`ghcr.io/vasilymarchenko/teachers-migrator`, tagged `latest` and
`sha-<short-sha>` from the same workflow run as `teachers`.
`docker-compose.prod.yml`'s `migrate` service and `web` service both read a
single `IMAGE_TAG` variable from `.env`, so they always name the same tag and
never drift onto different commits.

## Consequences

One more GHCR image to publish and store, and every deploy pulls two images
instead of one. In exchange: the VPS never builds anything (matches
`docs/tech-stack.md`'s deploy row as written), a redeploy's migration always
matches the code it is migrating for, and a rollback is one variable
(`IMAGE_TAG`) instead of two that have to be kept in sync by hand.

Revisit this if the two images' build steps diverge enough that keeping them
in the same workflow run stops being convenient — at that point, tagging both
from a shared commit SHA (rather than from one workflow run's shared metadata
step) would need to become the explicit contract instead of an accident of
this workflow's shape.
