---
id: T-024
type: ticket
title: CI — run the full gate on every pushed commit, and gate the image publish on it
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

Nothing runs until a commit reaches `main`. `docker-publish.yml` fires on `push`
to `main` and publishes `latest` unconditionally, so the first automated reading
of a change happens after it is merged — and a commit that does not compile
still becomes the tag the VPS pulls. Run the same gate a developer runs, on every
pushed commit, and let the publish depend on it.

The integration suite is the part this is really about: it needs a migrated
Postgres, so it is the one suite that cannot run on a machine that happens to
have no database. T-010 shipped with four unexecuted tests for that reason.

## Acceptance criteria

- [ ] The gate runs on **every pushed commit, on any branch**, against that
      commit — not against a preview of it merged into `main`. A branch is
      checked on its own terms, and its result is not disturbed by `main` moving
      underneath it.
- [ ] There is no second entry point and no separate pre-merge run: a status
      attaches to a commit, so the pull request shows the run its head commit
      already has. Opening, reopening or re-targeting a pull request re-runs
      nothing, because the commit has not changed.
- [ ] Branch protection on `main` requires **both** the gate and *"Require
      branches to be up to date before merging"*. The second is what makes the
      first a statement about `main`: a branch that contains the current `main`
      merges to the same tree it was checked at. Without it the gate is a claim
      about the branch alone.
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
- [ ] Both Docker images build on a gated commit — `runner` and `migrator`, the
      two targets of ADR-003 — **without** being pushed anywhere but from `main`.
      Nothing validates the Dockerfile before merge today.
- [ ] The publish job runs only after the gate passes on `main`, and only on
      `main`. A red gate publishes nothing.
- [ ] Only the publish job holds `packages: write`; the gate runs with
      `contents: read` and no registry credentials. `pull_request_target` is not
      used at all — it runs with the base branch's permissions and a writable
      token, which is the one trigger that could turn an unreviewed commit into a
      registry push.
- [ ] The migrator image is proved to migrate: it is run against a throwaway
      Postgres and asserted to exit 0 and leave the schema in place. Nothing
      checks this before a deploy today (ADR-003).
- [ ] A superseded run on the same branch is cancelled rather than left to
      finish, and every job has a `timeout-minutes`.
- [ ] The choice of how CI provisions Postgres, and of one shared definition of
      the checks over two duplicated workflows, is recorded in an ADR with the
      alternatives that were rejected.
- [ ] `docs/tech-stack.md` (the Deploy row) and the README's deploy section say
      that the publish is gated, and by what.
- [ ] A merge into `main` is itself a push and therefore gated by the same run,
      with the publish depending on it. A workflow that reports failure but does
      not block a merge is a notification, not a gate — PR #17 was merged with
      nothing required and nothing run.

## Notes

Raised from the review of PR #17: the integration suite could not run in the
review environment, so `getUpcomingYearFrame()`'s four cases were merged
unexecuted. That is not a property of that review — no environment runs them
automatically today.

Five things the implementation has to decide, none settled here:

- **Where the Postgres version is pinned once.** Three files name
  `postgres:16-alpine` after this ticket. Either one of them becomes the source
  the others are checked against, or a test asserts they agree — the second is
  the cheaper shape and matches `queryDiscipline.test.ts` and T-022.
- **Whether the validating build and the publishing build are one step or two.**
  Sharing means the gate carries a `push` input and therefore the permission that
  goes with it; repeating means two builds, made nearly free by the `type=gha`
  cache already configured, and a permission boundary that stays where it is. The
  second is the recommendation and the reason is the boundary, not the cache.
- **How much of the gate every branch push deserves.** Checking each commit
  once is the point, but the Docker builds and the migrator smoke test are the
  slow half and say nothing about a work-in-progress commit. Limiting those two
  to `main` and to branches with an open pull request is the obvious trim; it
  costs the guarantee that the head commit was checked *whole*, which is the
  guarantee branch protection leans on.
- **Fork pull requests are not covered.** `push` does not fire for someone who
  cannot push to the repository, so an outside contribution would arrive
  unchecked. Adding a `pull_request` trigger is the answer when that day comes —
  it is deliberately not added now, because it would double every run to cover a
  contributor the repository does not have.
- **Whether the migrator smoke test and the integration suite share one
  database.** They want opposite things — the suite wants the schema already
  applied, the smoke test wants to apply it — so a shared service makes the two
  jobs ordered rather than parallel. Two databases keep them independent.

Out of scope: a preview deployment per pull request, and running the suite
against more than one Postgres version. Neither is a first-release need.
