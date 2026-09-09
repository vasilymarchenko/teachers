---
id: T-029
type: ticket
title: One gate command and a bounded review loop for /teachers-ticket
status: todo
depends_on: [T-017, T-024]
refs:
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - .github/workflows/ci.yml
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
  - docs/architecture/decisions/ADR-007-ci-gate.md
  - docs/backlog/T-026-deterministic-ticket-loop.md
---

## Goal

Give `/teachers-ticket` one command that decides whether a change is checked,
one file that remembers what that command said, and a phase 7 that loops to a
stated exit criterion instead of running once. The check list is held in step
with `ci.yml`; the memory survives a compacted context; the authority for *done*
stays outside the agent — the gate's exit code and `gh pr checks`.

## Acceptance criteria

- [ ] `npm run gate` is one command and the only one either skill runs to check
      a change. It resolves `git diff --name-only origin/main...HEAD` plus the
      uncommitted change, selects checks by path, runs **all** of them without
      short-circuiting, prints one table, exits non-zero when any check failed
      and writes `.gate/last-run.json`. A lint error and three red tests are one
      report, not three round-trips.
- [ ] The gate edits nothing and pushes nothing. `.gate/` is the only path it
      writes and it is gitignored.
- [ ] The routing is stated once and covers what `ci.yml` runs: always `lint`,
      `typecheck`, `test`, `build`; `lib/db/**` or `drizzle/**` adds
      `db:migrate`, `scripts/verify-schema.sql` and `test:integration`;
      `Dockerfile` or `docker-compose*.yml` adds the `runner` and `migrator`
      builds and the migrator smoke test. `build` and `verify-schema.sql` are in
      `ci.yml` and in neither skill today, so a pull request can be verified
      locally and red in CI.
- [ ] A test holds that list in step with `ci.yml`'s three gate jobs — the
      `lib/db/postgresImage.test.ts` pattern, which already holds one value
      across two files. Scoped to those jobs rather than to the whole workflow:
      a future job that runs an npm script for some other purpose must not have
      to become a gate check to keep the suite green.
- [ ] A check the gate cannot run here — no Docker daemon, no `DATABASE_URL` —
      is reported as `skipped` with the reason, in the table and in the pull
      request body. A skip is never reported as a pass.
- [ ] `/teachers-ticket` phase 6 and `/teachers-review` phase 3 both invoke it.
      No `&&` chain of checks remains in either skill.
- [ ] Every run appends one row per check to `.gate/ledger.jsonl`: check name,
      result, exit code, the commit it ran against, and when. The file is
      **memory, not enforcement** — a session resumed after compaction reads it
      and carries on instead of re-attesting from a conversation it no longer
      has, and nothing refuses to run a check on account of what it says.
- [ ] Phase 7 is a loop with a written exit criterion — review → triage → fix →
      gate → re-review, ending when the latest round leaves no finding
      undisposed — and one cap: **at most three review rounds**. Hitting it stops
      the loop and reports what is still open rather than opening a fourth.
- [ ] A round is recorded in `.gate/findings.json` as a list, each finding
      carrying an id, a `file:line`, the rule quoted from the document it comes
      from, a one-sentence summary and which pass found it, so round *N* and
      round *N+1* are two lists that can be compared. Each is then disposed as
      `fixed`, `rejected` — the document text that refutes the quoted rule —
      `deferred` to a `T-NNN` that exists, or `accepted` by the user. The skill
      states the vocabulary and what each disposition costs; no code validates
      the file.
- [ ] The acceptance-criteria checkboxes are ticked in phase 7, after the gate is
      green, and only where the evidence names a `file:line` or a test. They are
      ticked in phase 5 today, before phase 6 has run a single check.
- [ ] `gh pr checks` on the pushed head is the last gate: the ticket is not
      reported done while that run is red or pending, and where `gh` cannot read
      it the report says so — never that it passed. `ci.yml` is the authoritative
      gate (`ADR-007`) and neither skill looks at it today.
- [ ] A diff-hygiene check: no `.only` in a test, no `.env` in the diff, and the
      block `next dev` re-adds to `CLAUDE.md` committed with the work rather than
      handed over as a stray change.
- [ ] One ADR records the one decision worth recording — that the local gate and
      `ci.yml` keep a single check definition, held in step by a test rather than
      by one calling the other — referencing `ADR-007` and `ADR-001` instead of
      re-arguing either.

## Notes

Replaces **T-026**, which is `declined`. T-026 asked for this flow and then for a
layer of code to police the agent's own record of it. The criteria above are
T-026's minus that layer.

**Explicitly out of scope.** Each of these is in T-026's implementation on
`claude/ticket-t-026-deterministic-ticket-loop` (PR #22), and each is why that
branch reached ~2,100 lines under `scripts/gate/`:

- **Re-run counting, working-tree hashing, and any refusal to run a check.**
  T-026 asked for "exactly one re-run", keyed on a hash of the working tree. An
  environment fix — starting Postgres, exporting a variable — changes no file, so
  the gate refuses to run a check the developer has just repaired and the escape
  is a no-op edit. Whether a red check was a flake is a judgment the developer
  makes; the ledger records what happened and does not police it.
- **A validator over `.gate/findings.json`.** It can check that a field is not
  empty, never that it is true. T-026's own second round recorded a finding
  `fixed` on evidence naming code that did not exist, with the validator in
  place.
- **A per-check fix cap.** One round cap is an integer in a file; a per-check cap
  needs the attempt counting above.
- **A second implementation of `scripts/verify-schema.sql`.** Run the file the
  way CI runs it — `psql`, from the Postgres container that is already up —
  rather than through a driver, which constrains what may be written in it and
  gives one assertion file two execution paths.
- **A local reimplementation of CI's images job.** Either route the check to the
  same commands `ci.yml` runs, or leave the job to CI. A second orchestration
  that deliberately differs from CI's does not predict CI.
- **A `Stop` hook.** Unchanged from T-026: the only shape where the harness
  enforces the loop instead of the model, and the right eventual one. It applies
  to every session in the repository, so it waits.

**Two things T-026 settled that stand.** The ledger lives in a gitignored
`.gate/` rather than the session scratchpad, because a human running
`npm run gate` in a terminal has no scratchpad path and a fresh session could not
find the previous one; the pull request body carries the summary.
`/teachers-review` keeps its own gate run, because that run is against the
checked-out target — the bug `T-017` found the hard way — and a caller's ledger
row would reinstate it the first time it was written against a different tree.

**A size expectation, not a criterion.** All of `scripts/gate/` should be a few
hundred lines. A criterion above that appears to need a thousand is being read as
a licence to build machinery: what makes the loop reliable is the gate's exit
code, one file it appends to, and `gh pr checks`.
