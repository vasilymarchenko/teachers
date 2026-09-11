---
id: T-029
type: ticket
title: One gate command and a bounded review loop for /teachers-ticket
status: done
depends_on: [T-017, T-024]
refs:
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/architecture/design/T-029-gate-and-loop.md
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
stated exit criterion instead of running once, under caps that are counted in
files rather than remembered. The check list is held in step with `ci.yml`; the
memory survives a compacted context; the authority for *done* stays outside the
agent — the gate's exit code and `gh pr checks`.

## Acceptance criteria

- [x] `npm run gate` is one command and the only one either skill runs to check
      a change. It resolves `git diff --name-only origin/main...HEAD` plus the
      uncommitted change, selects checks by path, runs **all** of them without
      short-circuiting, prints one table, exits non-zero when any check failed
      and writes `.gate/last-run.json`. A lint error and three red tests are one
      report, not three round-trips.
- [x] The gate edits nothing and pushes nothing. `.gate/` is the only path it
      writes and it is gitignored.
- [x] The routing is stated once and covers what `ci.yml` runs: always `lint`,
      `typecheck`, `test`, `build`; `lib/db/**` or `drizzle/**` adds
      `db:migrate`, `scripts/verify-schema.sql` and `test:integration`;
      `Dockerfile` or `docker-compose*.yml` adds the `runner` and `migrator`
      builds and the migrator smoke test. `build` and `verify-schema.sql` are in
      `ci.yml` and in neither skill today, so a pull request can be verified
      locally and red in CI.
- [x] A test holds that list in step with `ci.yml`'s three gate jobs — the
      `lib/db/postgresImage.test.ts` pattern, which already holds one value
      across three files. Scoped to those jobs rather than to the whole workflow:
      a future job that runs an npm script for some other purpose must not have
      to become a gate check to keep the suite green. There is no YAML parser in
      this project and this does not justify adding one — slice the file at its
      job headers and say so in a comment, which is a few lines more than
      matching the whole file and is the reason to prefer it.
- [x] A check the gate cannot run here — no Docker daemon, no `DATABASE_URL` —
      is reported as `skipped` with the reason, in the table and in the pull
      request body. A skip is never reported as a pass.
- [x] `/teachers-ticket` phase 6 and `/teachers-review` phase 3 both invoke it.
      No `&&` chain of checks remains in either skill.
- [x] Every run appends one row per check to `.gate/ledger.jsonl`: check name,
      result, exit code, the commit it ran against, and when. The file is
      **memory, not enforcement** — a session resumed after compaction reads it
      and carries on instead of re-attesting from a conversation it no longer
      has, and nothing refuses to run a check on account of what it says.
- [x] Phase 7 is a loop with a written exit criterion — review → triage → fix →
      gate → re-review, ending when the latest round leaves no finding
      undisposed — and three caps, all of them **three**: at most three review
      rounds; at most three gate runs within one round; at most three pushes to
      the pull request after the one that opened it. The second and third are the
      loops T-026 left unbounded and this ticket nearly did too — a red check
      fixed and re-gated inside a round, and a red CI run fixed and re-pushed
      after it.
- [x] Re-running the gate against an unchanged tree in the hope of a different
      answer is not one of those three attempts. It is not permitted and the
      skill says so — as a rule the skill states, not as a refusal the gate
      enforces.
- [x] Hitting any cap stops the loop and reports what is still open, rather than
      opening a fourth. The gate names the count it is on in its own output, so a
      cap being approached is visible in the terminal without anyone reading a
      file for it.
- [x] A round is recorded in `.gate/findings.json` as a list, each finding
      carrying an id, a `file:line`, the rule quoted from the document it comes
      from, a one-sentence summary and which pass found it, so round *N* and
      round *N+1* are two lists that can be compared. Each is then disposed as
      `fixed`, `rejected` — the document text that refutes the quoted rule —
      `deferred` to a `T-NNN` that exists, or `accepted` by the user. The skill
      states the vocabulary and what each disposition costs; no code validates
      the file.
- [x] The cap numbers live in code — one module exports them — and both skills
      reference that module rather than restating a number that then drifts out
      of step with it.
- [x] Each count is derived from a record the agent did not author, wherever one
      exists: the gate runs in the current round from the distinct run ids the
      gate itself appended to `.gate/ledger.jsonl` since that round's timestamp,
      and the pushes from the commits on the branch. Only the review-round number
      is agent-written, in `.gate/findings.json`. A count held in the
      conversation is not a count — that is the one thing compaction is
      guaranteed to take.
- [x] `npm run gate -- --report` exits non-zero and refuses to report the ticket
      done when a cap is exceeded, naming which. **Nothing refuses to run a
      check.** A refused measurement blocks the recovery — the check is what
      tells the truth, and an environment fix changes no file — while a refused
      conclusion blocks only the claim, and stopping to report what is open is
      the right answer at a cap anyway.
- [x] The acceptance-criteria checkboxes are ticked in phase 7, after the gate is
      green, and only where the evidence names a `file:line` or a test. They are
      ticked in phase 5 today, before phase 6 has run a single check.
- [x] `gh pr checks` on the pushed head is the last gate: the ticket is not
      reported done while that run is red or pending, and where `gh` cannot read
      it the report says so — never that it passed. `ci.yml` is the authoritative
      gate (`ADR-007`) and neither skill looks at it today.
- [x] A diff-hygiene check: no `.only` in a test, no `.env` in the diff, and the
      block `next dev` re-adds to `CLAUDE.md` committed with the work rather than
      handed over as a stray change.
- [x] One ADR records the one decision worth recording — that the local gate and
      `ci.yml` keep a single check definition, held in step by a test rather than
      by one calling the other — referencing `ADR-007` and `ADR-001` instead of
      re-arguing either.
- [x] The loop is exercised once by a session that loaded the new skills — a
      different ticket, in a fresh session, after this one is merged — and this
      ticket is not `done` until it has been. **The session that writes the loop
      cannot run it:** a skill's text enters context when it is invoked, so
      phases 6 and 7 of that session execute the version loaded before phase 5
      edited it. Whatever it reports about the loop describes the loop rather
      than evidencing it, and a round it narrates was hand-simulated from the
      conversation — which is where both of T-026's own worst defects came from,
      a disposition recorded `fixed` on code that did not exist and a round
      reported complete while it was still running.

## Notes

The last criterion was satisfied by session `4c401314` — a fresh session, after
a `/clear`, that loaded the merged skills and ran `/teachers-ticket T-021` to
PR #26: three review rounds, three pushes, `npm run gate` green and `ci.yml`
green on the pushed head `c1b6ea4`. The loop reached its exit at the round and
push caps rather than with margin, which is itself the evidence that the caps
are counted and enforced. The cost of that run, measured from its transcript, is
what `T-033` and `T-034` were written from.

Replaces **T-026**, which is `declined`. T-026 asked for this flow and then for a
layer of code to police the agent's own record of it. The criteria above are
T-026's minus that layer.

**Explicitly out of scope.** Each of these is in T-026's implementation on
`claude/ticket-t-026-deterministic-ticket-loop` (PR #22), and each is why that
branch reached ~2,100 lines under `scripts/gate/`:

- **Working-tree hashing, and any refusal to run a check.** Counting attempts is
  in scope and the criteria above ask for it; keying that count on a hash of the
  working tree is not. An environment fix — starting Postgres, exporting a
  variable — changes no file, so T-026's gate refused to run a check the
  developer had just repaired and the escape was a no-op edit. Refuse the
  conclusion, never the measurement.
- **Deciding for the developer whether a red check was a flake.** T-026 made
  green-on-the-second-run a `flake` row owing a ticket, which requires knowing
  that the two runs asked about the same tree. The ledger records that a check
  was red and then green; what that means is a judgment, and `T-028` is what one
  looks like when it is made properly.
- **A validator over `.gate/findings.json`.** It can check that a field is not
  empty, never that it is true. T-026's own second round recorded a finding
  `fixed` on evidence naming code that did not exist, with the validator in
  place.
- **A per-check fix cap.** Attributing attempts to a particular check is what
  forces the tree hashing above — the count has to know when an edit reset it.
  Counting gate runs within a round needs no attribution at all: the run ids are
  already in the ledger and the round boundary is already in the findings file.
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

**One exception to "nothing refuses to run a check", added after this ticket.**
`T-031` gives `run()` a single preflight ahead of check selection: a Node too
old to run `test` or `build` at all is not an environment gap a check can name
for itself the way `unmetRequirement()` does, so the gate fails outright with
one named reason instead of reaching the check loop. It is recorded — `failed`,
with a `reason`, through the same ledger and `last-run.json` path as everything
else — never a bare refusal with no record behind it, which is what the
criterion above is actually guarding against. Mechanics:
`docs/architecture/design/T-029-gate-and-loop.md` §4.

**Two things T-026 settled that stand.** The ledger lives in a gitignored
`.gate/` rather than the session scratchpad, because a human running
`npm run gate` in a terminal has no scratchpad path and a fresh session could not
find the previous one; the pull request body carries the summary.
`/teachers-review` keeps its own gate run, because that run is against the
checked-out target — the bug `T-017` found the hard way — and a caller's ledger
row would reinstate it the first time it was written against a different tree.

**How hard the caps actually are.** Durable, not unskippable. The numbers live
in code and the counts in files the agent mostly did not write, so a compacted
session cannot lose them and `--report` will not say `done` past a cap. Nothing
compels the agent to run `--report` at all, and the honest backstops past that
point are both outside the session: `gh pr checks`, and the person reading the
report. The `Stop` hook above is the only thing that would close it, and it is
deferred. The ticket says so rather than implying a guarantee it does not have.

**A size expectation, not a criterion.** All of `scripts/gate/` should be a few
hundred lines. A criterion above that appears to need a thousand is being read as
a licence to build machinery: what makes the loop reliable is the gate's exit
code, one file it appends to, and `gh pr checks`.

---

**Implementation.** The mechanics are `docs/architecture/design/T-029-gate-and-loop.md`;
the one decision worth recording is
`decisions/ADR-012-one-check-definition.md` — the local gate and `ci.yml` keep
one check definition, held in step by `scripts/gate/checks.ci.test.ts` rather
than by one calling the other.

**Eighteen of the nineteen criteria are ticked**, each against a `file:line` or
a test named in PR #24. The nineteenth is below.

**Why this stays `in-progress`.** The last criterion cannot be satisfied by the
session that implements the ticket, by its own argument: a skill's text enters
context when it is invoked, so that session's phases 6 and 7 run the version
loaded before phase 5 edited it. It closes when a later session, on a different
ticket, has worked the new loop end to end — and that session ticks the box and
sets `done`.

**One criterion was read narrowly, deliberately.** The routing covers the
migrator smoke test, but the check is always `skipped` here rather than run: CI
performs it as a five-step orchestration, and transcribing that into a second
file is the local reimplementation this ticket's own `## Notes` rule out. It is
therefore never reported as checked locally. `T-030` unifies the two into one
script called by both.
