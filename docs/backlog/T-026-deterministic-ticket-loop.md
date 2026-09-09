---
id: T-026
type: ticket
title: Deterministic feedback loop for /teachers-ticket — one gate, a run ledger, a bounded review loop
status: todo
depends_on: [T-017, T-024]
refs:
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - .github/workflows/ci.yml
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
  - docs/architecture/decisions/ADR-007-ci-gate.md
---

## Goal

Every phase transition in `/teachers-ticket` is currently self-attested: the
agent decides a phase passed, and nothing outside the agent can disagree. Give
the skill one gate command whose check list is held in step with `ci.yml`, a
written ledger of what actually ran, and a phase 7 that loops to a stated exit
criterion instead of running once.

The standard the loop measures against does not change — it stays the
repository's documents, read at review time (`ADR-001`). What changes is that
the *result* of measuring is recorded rather than remembered.

## Acceptance criteria

- [ ] `npm run gate` runs the checks required by the diff: it resolves
      `git diff --name-only origin/main...HEAD`, selects checks by path, runs
      **all** of them without short-circuiting, prints one table, and writes a
      machine-readable result. A lint error and three red tests are one report,
      not three round-trips.
- [ ] The routing is stated once and covers what `ci.yml` covers:
      always `lint`, `typecheck`, `test`, `build`; `lib/db/**` or `drizzle/**`
      adds `db:migrate`, `scripts/verify-schema.sql` and `test:integration`;
      `Dockerfile` or `docker-compose*.yml` adds the `runner` and `migrator`
      builds and the migrator smoke test.
- [ ] A test holds the gate's check list and `ci.yml` in step, so a check added
      to CI and not to the gate fails the suite —
      the `lib/db/postgresImage.test.ts` pattern, which already holds one value
      across two files.
- [ ] `npm run build` and `scripts/verify-schema.sql` are in the gate. Neither is
      in the skill today (`SKILL.md:197`, `SKILL.md:201-203`) while both are in
      `ci.yml`, so a PR can be verified locally and red in CI.
- [ ] `/teachers-ticket` phase 6 and `/teachers-review` phase 3 both invoke the
      gate. No `&&` chain of checks remains in either skill: the review skill
      already states why (`teachers-review/SKILL.md:101-107`) and the ticket
      skill still contradicts it.
- [ ] A run ledger records one row per gate: name, result, exit code, the commit
      it ran against, and when. No phase may be reported as passed without a
      row; the final report to the user is derived from the ledger, not from the
      conversation; a session resumed after compaction reads it and continues
      rather than re-attesting.
- [ ] Phase 7 is a loop with a written exit criterion: review → triage → fix →
      gate → re-review, ending when no finding remains undisposed. Caps are
      stated and honoured — at most three review rounds, at most three fix
      attempts per failing check — and hitting a cap stops the loop and reports
      the ledger to the user instead of churning.
- [ ] A finding has four dispositions, each recorded with the finding:
      **fixed**, **rejected** with the document text that refutes the rule the
      reviewer quoted, **deferred** to a named `T-NNN`, or **accepted** by the
      user. The skill offers two today — apply it (`SKILL.md:238`) or defer it
      (`SKILL.md:241`) — and no way to record that a finding was wrong, which is
      an outcome `/teachers-review`'s own evidence bar produces on purpose.
- [ ] Both review passes return findings in a countable form, so round *N* and
      round *N+1* can be compared and convergence is computed rather than
      asserted. Prose findings cannot be diffed, and a loop that cannot tell
      whether it converged has no exit criterion.
- [ ] A single flaky failure is distinguished from a red check by exactly one
      re-run: green on the re-run is recorded as a flake and filed as a ticket;
      red again is a finding. Retrying until green is not permitted.
- [ ] Acceptance-criteria checkboxes are ticked in phase 7, after the gate is
      green, and only where an evidence row names a `file:line` or a test. They
      are ticked in phase 5 today (`SKILL.md:183`), before phase 6 has run a
      single check.
- [ ] CI green on the pushed head is the last gate: the loop reads
      `gh pr checks` and does not report the ticket done while the run is red or
      pending. Where `gh` is unavailable the report says so — never that the run
      passed. `ci.yml` is the authoritative gate (`ADR-007`) and the skill does
      not currently look at it, while its definition of done claims checks
      "pass on the pushed head" (`SKILL.md:258`).
- [ ] A diff-hygiene gate: every changed file appears in the approved plan's
      file list or is explained in the report; no `.only` and no newly added
      `.skip` in a test; no `.env`; the block `next dev` re-adds to `CLAUDE.md`
      is committed with the work or absent, never left as a stray change.
- [ ] The gate edits nothing and pushes nothing. It reports, like the review it
      feeds.
- [ ] The decision that the local gate and CI have one definition, and that
      phase 7 is bounded rather than run once, is recorded as an ADR that
      references `ADR-007` and `ADR-001` rather than re-arguing either, and is
      named from this ticket's `## Notes`.

## Notes

Raised by an analysis of `.claude/skills/teachers-ticket/SKILL.md` on
2026-09-09, not by a review of a product diff. The skill's standard is sound —
the finding bar of `/teachers-review` phase 5 and the no-copied-rules discipline
of `ADR-001` both hold — and the gaps are all in the loop around it.

**The loop already iterates; it just does so unrecorded.** T-012 shipped two
review-fix commits, `918f4a3` and `7632913`, where the skill describes one pass.
The second round found "a repetition that outlived the form it was chosen on"
and "an ADR the calendar had quietly outgrown" — findings the single documented
pass had missed. A phase that in practice runs twice and on paper runs once has
no exit criterion, and its caps are whatever the session had patience for.

Three things this ticket deliberately does not do:

- **It does not make `ci.yml` call the gate.** The workflow splits into jobs on
  purpose — the integration job needs a `services:` Postgres and the images job
  needs buildx — and collapsing them into one script would cost the parallelism
  and the isolation `ADR-007` chose. Holding the two in step with a test is the
  cheaper half of the same guarantee, and it is the mechanism
  `postgresImage.test.ts` already uses for the image version.
- **It does not add a `Stop` hook.** A hook that refuses to end a turn while the
  ledger is stale or red is the only option where the harness enforces the loop
  instead of the model, and it is the right eventual shape. It also applies to
  every session in the repository, not only to this skill, so it waits until the
  gate is known to be fast enough to run at the end of every turn.
- **It does not move any rule into the skill.** Everything above is about
  recording that a check ran and what it said.

Two things the implementation has to decide, neither settled here:

- **Where the ledger lives.** Committed, it lands in the diff under review and
  is noise a reviewer has to skip. Gitignored or in the session scratchpad, it
  survives compaction but a reviewer cannot see it, so the PR body has to carry
  the summary. The leaning is the scratchpad plus a summary in the PR body,
  because the ledger's reader is the resuming agent and the PR body's reader is
  a human.
- **Whether `/teachers-review` keeps its own gate run.** In self-review it now
  runs the same checks twice, once in phase 6 of the caller and once in phase 3
  of the review. That is not waste: the review's run is against the *checked-out
  target*, which is the bug `T-017` found and fixed the hard way. Passing a
  ledger row instead would restore exactly that bug if the row was written
  against a different tree, so the second run should probably stay and the
  ticket should say so rather than dedupe it.
