---
id: T-024
type: ticket
title: CI — run the full gate on pull requests, and gate the image publish on it
status: todo
depends_on: [T-015]
refs:
  - docs/tech-stack.md
  - docs/architecture/decisions/ADR-003-migrator-image.md
  - docs/architecture/design/schema.md §4.7
  - .github/workflows/docker-publish.yml
  - README.md
---

## Goal

Nothing runs on a pull request. `docker-publish.yml` fires on `push` to `main`
and publishes `latest` unconditionally, so the first automated reading of a
change happens after it is merged — and a commit that does not compile still
becomes the tag the VPS pulls. Run the same gate a developer runs, on every pull
request and on `main`, and let the publish depend on it.

The integration suite is the part this is really about: it needs a migrated
Postgres, so it is the one suite that cannot run on a machine that happens to
have no database. T-010 shipped with four unexecuted tests for that reason.

## Acceptance criteria

- [ ] The checks are defined **once** and run from two entry points: a pull
      request against `main`, and a push to `main`. Neither entry point restates
      a step the other has.
- [ ] The gate covers `npm run lint`, `npm run typecheck`, `npm test`,
      `npm run build` and `npm run test:integration` — the five commands the root
      `CLAUDE.md` names, no fewer.
- [ ] `npm run test:integration` runs against a real PostgreSQL 16 with
      `drizzle-kit migrate` applied first, and the exclusion constraint of
      `design/schema.md` §4.7 is exercised: a run where the extension or the
      migration silently did not apply must fail, not pass with fewer tests.
- [ ] The database is ephemeral and belongs to the run. `docker-compose.yml` is
      not reused — it is dev-only by its own documentation (named volume,
      `restart: unless-stopped`, a published host port), and none of that is
      wanted in CI.
- [ ] The Postgres major version used in CI is the one `docker-compose.yml` and
      `docker-compose.prod.yml` pin. A skew is caught mechanically, not by
      review: a check fails when the three disagree.
- [ ] Both Docker images build on a pull request — `runner` and `migrator`, the
      two targets of ADR-003 — **without** being pushed. Nothing validates the
      Dockerfile before merge today.
- [ ] The publish job runs only after the gate passes on `main`, and only on
      `main`. A red gate publishes nothing.
- [ ] Only the publish job holds `packages: write`; the gate runs with
      `contents: read` and no registry credentials. The trigger is
      `pull_request`, never `pull_request_target`.
- [ ] The migrator image is proved to migrate: it is run against a throwaway
      Postgres and asserted to exit 0 and leave the schema in place. Nothing
      checks this before a deploy today (ADR-003).
- [ ] A superseded run on the same pull request is cancelled rather than left to
      finish, and every job has a `timeout-minutes`.
- [ ] The choice of how CI provisions Postgres, and of one shared definition of
      the checks over two duplicated workflows, is recorded in an ADR with the
      alternatives that were rejected.
- [ ] `docs/tech-stack.md` (the Deploy row) and the README's deploy section say
      that the publish is gated, and by what.
- [ ] The repository's branch protection on `main` requires the gate. A workflow
      that reports failure but does not block a merge is a notification, not a
      gate — PR #17 was merged with nothing required and nothing run.

## Notes

Raised from the review of PR #17: the integration suite could not run in the
review environment, so `getUpcomingYearFrame()`'s four cases were merged
unexecuted. That is not a property of that review — no environment runs them
automatically today.

Three things the implementation has to decide, none settled here:

- **Where the Postgres version is pinned once.** Three files name
  `postgres:16-alpine` after this ticket. Either one of them becomes the source
  the others are checked against, or a test asserts they agree — the second is
  the cheaper shape and matches `queryDiscipline.test.ts` and T-022.
- **Whether the image build on a pull request and the publish on `main` share a
  build step or repeat it.** Sharing means the gate carries a `push` input and
  therefore the permission that goes with it; repeating means two builds, made
  nearly free by the `type=gha` cache already configured, and a permission
  boundary that stays where it is. The second is the recommendation and the
  reason is the boundary, not the cache.
- **Whether the migrator smoke test and the integration suite share one
  database.** They want opposite things — the suite wants the schema already
  applied, the smoke test wants to apply it — so a shared service makes the two
  jobs ordered rather than parallel. Two databases keep them independent.

Out of scope: a preview deployment per pull request, and running the suite
against more than one Postgres version. Neither is a first-release need.
