---
id: ADR-011
title: The local gate and CI have one definition, and the review loop is bounded
status: accepted
date: 2026-09-09
ticket: T-026
---

## Context

ADR-007 made `.github/workflows/ci.yml` the authoritative gate: every pushed
commit is checked, and the image publish is gated on that run. ADR-001 made the
review tooling hold method only, so the standard a review measures against is
the repository's documents, read at review time.

Neither says anything about what happens between the two — the loop
`/teachers-ticket` runs from a plan to a merged pull request. That loop was
entirely self-attested. The agent decided a phase had passed, and nothing
outside the agent could disagree.

Three facts made that concrete rather than theoretical.

**The two definitions of "checked" had already drifted.** `ci.yml` runs `lint`,
`typecheck`, `test`, `build`, `db:migrate`, `scripts/verify-schema.sql`,
`test:integration`, both image builds and a migrator smoke test.
`teachers-ticket/SKILL.md` phase 6 ran `npm run lint && npm run typecheck &&
npm test`, adding `test:integration` by hand when `lib/db` was touched. `build`
and `verify-schema.sql` were in neither skill, so a pull request could be
verified locally and red in CI — and `/teachers-review` phase 3 had already
written down why the `&&` was wrong while the ticket skill still used it.

**The loop already iterated; it just did so unrecorded.** T-012 shipped two
review-fix commits, `918f4a3` and `7632913`, where the skill described one pass.
The second round found two real defects the first had missed. A phase that in
practice runs twice and on paper runs once has no exit criterion, and its caps
are whatever the session had patience for.

**A finding had two possible outcomes and needed four.** The skill offered "fix
it" and "defer it". `/teachers-review`'s evidence bar exists to kill findings
that turn out to be wrong — *"if the document does not actually say what you
thought it said, the finding dies there"* — so a refuted finding is an outcome
the method produces on purpose, and there was no way to record one.

Two further facts constrain the shape of any answer. A context window is
compacted, so anything held only in the conversation is lost mid-ticket, and the
report at the end is then written from what the agent remembers. And `main` had
been red since 2026-09-06 (`9c37c40`), a commit pushed with no check run at all,
which nothing in the loop noticed.

## Options

### Holding the gate and CI to one definition

1. **Make `ci.yml` call `npm run gate`.** One script, literally one definition,
   nothing to drift. It costs the job graph: the integration job needs a
   `services:` Postgres and the images job needs buildx, and ADR-007 chose those
   four jobs for the parallelism and the isolation between them. Collapsing them
   into one script on one runner would serialise the slow half and put a
   registry-adjacent build in the same process as the unit tests.
2. **Two definitions, held in step by a test.** The gate lists, per check, the
   `ci.yml` step it stands for; a test extracts the npm scripts, the Docker build
   targets and the SQL scripts `ci.yml` actually runs and fails when the two sets
   differ. It cannot prove the two *run* the same way — only that neither has a
   step the other lacks. It is the mechanism `lib/db/postgresImage.test.ts`
   already uses to hold one Postgres version across three files, and it costs
   nothing at run time.
3. **Leave it to discipline.** What was already in place. It had drifted by two
   checks within one ticket of being written.

### Where the ledger lives

1. **Committed.** A reviewer sees it. It also lands in the diff under review as
   noise, and every gate run dirties the working tree — which collides with the
   diff-hygiene check the same ticket adds.
2. **The session scratchpad.** Truly ephemeral. But `npm run gate` run by a
   human in a terminal has no scratchpad path, so the gate could not write its
   own ledger; the agent would have to pass one in, and a fresh session could not
   find the previous one.
3. **A gitignored directory in the repository.** The gate writes it wherever it
   runs, human or agent. It survives compaction and a new session. A reviewer
   cannot see it, so the pull request body has to carry the summary.

### How much of the loop the harness enforces

1. **A `Stop` hook** that refuses to end a turn while the ledger is stale or
   red. The only option where the harness enforces the loop instead of the model,
   and the right eventual shape. It also applies to every session in the
   repository, not only to this skill, and the gate now includes `npm run build`.
2. **The tool refuses what the rule forbids, and the skill states the rest.**
   The re-run cap and the fix cap are refusals in the gate; the round cap and the
   dispositions are computed by `--report` and stated in the skill.

## Decision

Option 2 in all three.

**`npm run gate` is the one entry point.** It resolves
`git diff --name-only origin/main...HEAD` plus the uncommitted change set,
selects checks by path, runs **all** of them without short-circuiting, prints one
table and writes the ledger. `scripts/gate/checks.ts` is the single statement of
the routing; `scripts/gate/checks.test.ts` holds it in step with `ci.yml`.
`ci.yml` is unchanged and remains the authoritative gate — the local gate is a
prediction of it, and `gh pr checks` on the pushed head is the last thing the
loop looks at.

The relationship is coverage, not equality: the gate may be wider than CI and
never narrower. `diff-hygiene` is the one gate-only check, because everything it
looks at is a property of the change rather than of the commit CI receives.

**The ledger is `.gate/`, gitignored.** One row per check — name, result, exit
code, commit, branch, time, attempt, and the *tree* it ran against — in
`ledger.jsonl`, the review's rounds and dispositions in `findings.json`. The
tree, not the commit, is the identity: the gate runs against the working tree,
so on a dirty one a row naming only `HEAD` claims a tree that was never
committed. No phase may be reported as passed without a row for the tree that is
checked out, and the final report is rendered from these files rather than from
the conversation. The pull request body carries the summary, because the ledger's
reader is the resuming agent and the body's reader is a human.

**Phase 7 is a loop with a computed exit criterion** — review, triage, fix,
gate, re-review, ending when the latest round holds no undisposed finding — and
two caps, at most three review rounds and at most three fix attempts per failing
check. A cap reached stops the loop and reports; it does not start another round.

**A finding has four dispositions**, each recorded with the evidence it costs:
`fixed` with the commit, `rejected` with the document text that refutes the rule
the reviewer quoted, `deferred` with a `T-NNN` that exists, `accepted` with what
the user said. Findings are returned as a countable list so two rounds can be
compared.

**A red check gets exactly one re-run**, counted against the *working tree*
rather than the commit or an opt-in flag: running the gate again with nothing
edited is the re-run, and a third attempt is refused without being run. Green on
the second is recorded as `flake`, never as `pass`, and owes a ticket; red again
is a finding. Keying it on the invocation was tried first and caps only the path
a careful caller volunteers into — the plain repetition the rule actually
forbids went uncounted.

## Consequences

The gate is slower than the chain it replaces — it includes `npm run build`, and
that is the point of including it. On a diff that touches `lib/db` or the
`Dockerfile` it is slower again, and those checks are skipped with a stated
reason where the machine cannot run them. A skipped check is never a pass, and
the pull request body has to repeat the reason.

Two definitions still exist, and the test between them proves set membership,
not equivalence. A step whose *command* changes in `ci.yml` — a new flag, a
different environment — passes the test while the two gates diverge in what they
actually do. Revisit if that ever bites; the answer then is option 1 for the
`checks` job alone, which has no service container and no buildx.

`/teachers-review` keeps its own gate run in self-review, so the same checks run
twice for one commit. That is deliberate. The review's run is against the
*checked-out target*, which is the bug T-017 found the hard way, and accepting a
ledger row from the caller instead would reinstate it the first time the row was
written against a different tree.

The gate writes only `.gate/`. It edits nothing and pushes nothing, so a hook
that ran it at the end of every turn would be safe — and that is the eventual
shape this decision deliberately stops short of. Revisit once the gate's own
runtime is known on a real ticket: a `Stop` hook is what moves enforcement from
the model to the harness, and it is worth the whole-repository blast radius only
if the gate is fast enough to run unprompted.
