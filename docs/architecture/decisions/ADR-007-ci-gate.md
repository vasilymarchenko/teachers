---
id: ADR-007
title: CI gates every pushed commit from one workflow, against a service-container Postgres
status: accepted
date: 2026-09-04
ticket: T-024
---

## Context

Until now the only automation was `.github/workflows/docker-publish.yml`, on
`push` to `main`, publishing `latest` and `sha-<short-sha>` unconditionally.
ADR-003 names that file as where the `migrator` image is built and pushed; this
decision deletes it, and ADR-003 is not edited to match — it records what was
true on its date. Its `migrate`-image contract is unchanged and now lives in
`ci.yml`'s `publish` job. The
first automated reading of a change therefore happened *after* it was merged,
and a commit that did not compile still became the tag the VPS pulls.

Five commands make up the gate a developer runs — `lint`, `typecheck`, `test`,
`build` and `test:integration`. The last is the one this decision is really
about. It needs a migrated Postgres, so it is the only suite that cannot run on
a machine that happens not to have a database, and PR #17 was merged with four
of its cases never executed for exactly that reason. Two further things had
never been executed anywhere before a deploy: the `Dockerfile`, and the
`migrator` image of ADR-003, whose whole job is to migrate a database.

Three constraints shaped the options. A GitHub status attaches to a *commit*, so
anything that checks a commit twice produces two answers for one thing.
`packages: write` plus a registry credential is the only capability in this
repository worth protecting, and `pull_request_target` — which runs with the
base branch's permissions and a writable token — is the one trigger that could
hand it to an unreviewed commit. And the exclusion constraints of
`design/schema.md` §4.7 live in a hand-written migration that the snapshot in
`drizzle/meta` does not track.

## Options

### How CI provisions Postgres

1. **Reuse `docker-compose.yml`.** One definition of the database for both
   developers and CI. But that file is dev-only by its own documentation — a
   named volume that outlives the run, `restart: unless-stopped`, and a
   published host port — and none of that is wanted on a runner. Making it serve
   both would mean parameterising it into something neither reader can scan.
2. **A GitHub Actions `services:` container.** The runner starts it before the
   job, health-checks it with `pg_isready` — over TCP rather than the compose
   files' unix socket, because the temporary server `initdb` runs answers on the
   socket while refusing every TCP connection — and destroys it with the job. Ephemeral by construction, and nothing about
   the dev-only file has to change or be worked around. It costs a third place
   naming the Postgres version.
3. **`docker run` by hand in a step.** Maximum control, and the only option when
   a job needs a database it starts *itself* — but for a service the job merely
   consumes it is the `services:` block written out longhand, plus a readiness
   loop and a cleanup step to forget.

### One workflow or two

1. **Two workflows — a gate and the existing publisher.** The publisher would
   have to re-state which checks count, or trust that a separate workflow ran;
   `workflow_run` chaining gives the publish a different commit context from the
   gate it depends on, which is precisely the confusion the gate exists to
   remove.
2. **One workflow, publish as a job with `needs:`.** The dependency is the
   ordinary job graph, the checks are defined once, and the publish cannot start
   before they are green because nothing schedules it until they are.

### Whether the validating build also publishes

1. **One build carrying a `push` input.** Half the Docker work, but the gate job
   then holds `packages: write` on every branch push, and the boundary that
   separates "checked" from "published" becomes a boolean in a job that runs on
   unreviewed commits.
2. **Two builds.** The gate builds and throws away; `publish` builds and pushes.
   The `type=gha` cache is already configured with per-target scopes, so the
   second build reuses the first's layers.

## Decision

Option 2 in all three.

`.github/workflows/ci.yml` replaces `docker-publish.yml`. It triggers on `push`
to `**` and on nothing else — no `pull_request`, and `pull_request_target` is
forbidden outright. Four jobs: `checks`, `integration`, `images`, and `publish`,
the last with `needs: [checks, integration, images]` and
`if: github.ref == 'refs/heads/main'`. The workflow's default permission is
`contents: read`; `publish` alone widens it to `packages: write`. Every job
carries `timeout-minutes`.

`integration` gets its Postgres from a `services:` container and `images` starts
its own with `docker run` — the two want opposite things from a database (the
suite wants the schema already applied, the migrator smoke test wants to apply
it), so they get one each and stay parallel rather than ordered.

Between `db:migrate` and the suite, and again after the migrator image has run,
CI executes `scripts/verify-schema.sql`: it asserts `btree_gist` is installed,
that all fourteen tables exist, and that the three `EXCLUDE` constraints are
present. `drizzle-kit migrate` reports success on work it did not do, and the
integration suite cannot tell a database that rejects overlaps from one with no
constraint to reject them with — it would simply pass, having proved less.

The Postgres version is now named in three files. None generates the others;
`lib/db/postgresImage.test.ts` reads all three and fails when they disagree.

The gate runs whole on every pushed commit, including the slow half. Trimming
the image builds to `main` and to branches with an open pull request was the
obvious saving and was rejected: branch protection leans on the head commit
having been checked *whole*, and a trim makes that true of some commits and not
others, with no signal saying which.

## Consequences

A green check on a branch is a statement about that branch, not about `main`.
What upgrades it is branch protection requiring these checks **and** *"Require
branches to be up to date before merging"*: a branch containing the current
`main` merges to the tree it was checked at. That setting is not in this
repository — it is repository configuration, recorded in README's "Deploying to
the VPS" — so the guarantee is only as good as the setting, and a workflow that
reports without blocking is a notification, not a gate.

Every WIP push costs two Docker builds and two Postgres containers. Superseded
runs are cancelled, which recovers most of it — except on `main`, which is
excluded from cancellation on purpose: that run publishes `sha-<short-sha>`, and
README's rollback instructions promise such a tag for every commit on `main`
whose gate passed. Cancelling it would leave a green commit with no image to
roll back to — the one case the tag exists for.

Fork pull requests are not covered: `push` does not fire for someone who cannot
push to the repository, so an outside contribution arrives ungated. A
`pull_request` trigger is the answer and is deliberately not added, because it
would double every run to cover a contributor this repository does not have.
Revisit on the first outside contribution — and note that adding it reopens the
"two answers for one commit" problem this decision closed, so the `push` trigger
would need narrowing at the same time.

Revisit the `services:` choice if a job ever needs two databases at once, or a
Postgres extension that the official image does not carry — at that point a
purpose-built image, named in the same one place the version is, costs less than
working around the block.
