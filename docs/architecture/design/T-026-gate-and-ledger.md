# The gate, the ledger and the review loop

**Ticket:** `docs/backlog/T-026-deterministic-ticket-loop.md`
**Status:** authoritative for T-026.

Rationale lives in `docs/architecture/decisions/ADR-011-one-gate-definition-and-a-bounded-review-loop.md`,
which references `ADR-007` (CI is the authoritative gate) and `ADR-001` (the
review reads the documents). This document adds no reasoning: it states the
check table, the routing, the ledger row shapes, the disposition vocabulary and
the caps.

**What is authoritative here, and what a skill may repeat.** `scripts/gate/` is
the implementation and this document describes it; where the two disagree, the
code is right and this file is a bug. `.claude/skills/**` may state the four
disposition *names* and the two caps, because an agent has to know them to work
and a skill that only pointed here would be unusable — but the exact JSON field
names, the routing patterns and the row shapes live only here, and the skills
link to the section rather than copying it. What makes that safe rather than
merely tidy is that `--report` validates every one of them: a skill that drifts
produces a loud refusal, not a quiet wrong answer.

## 1. Files

| File | Holds |
|---|---|
| `scripts/gate/checks.ts` | `CHECKS` — the single statement of the check table and its routing |
| `scripts/gate/run.ts` | the CLI: resolve the diff, select, run, record, print |
| `scripts/gate/exec.ts` | child processes; capture rather than inherit |
| `scripts/gate/git.ts` | porcelain parsing and the tree identity |
| `scripts/gate/ledger.ts` | `.gate/` paths, row shapes, the two counters the caps read |
| `scripts/gate/findings.ts` | findings, dispositions, convergence |
| `scripts/gate/hygiene.ts` | the diff-hygiene check |
| `scripts/gate/verifySchema.ts` | `scripts/verify-schema.sql` through the `postgres` driver |
| `scripts/gate/smoke.ts` | the two image builds and the migrator smoke test |
| `scripts/gate/report.ts` | the run table, the markdown summary, `--report` |

Tests sit beside each. `vitest.config.mts` includes `scripts/**/*.test.ts`, so
they run in `npm test` — which is itself one of the gate's checks.

## 2. The check table

Eleven checks — ten that `ci.yml` also runs, and `diff-hygiene`. `ci` names the step in `.github/workflows/ci.yml` the check stands
for; `checks.test.ts` asserts the two sets are equal in both directions for
every family it can extract generically (npm scripts, Docker build targets, SQL
scripts under `scripts/`) and that every other `ci` value occurs literally in
the workflow.

| Check | `ci` | Routed by | Needs |
|---|---|---|---|
| `lint` | `npm run lint` | always | — |
| `typecheck` | `npm run typecheck` | always | — |
| `test` | `npm test` | always | — |
| `build` | `npm run build` | always | — |
| `diff-hygiene` | `null` | always | — |
| `db:migrate` | `npm run db:migrate` | database paths | `DATABASE_URL` |
| `verify-schema` | `scripts/verify-schema.sql` | database paths | `DATABASE_URL` |
| `test:integration` | `npm run test:integration` | database paths | `DATABASE_URL` |
| `image:runner` | `target: runner` | image paths | docker |
| `image:migrator` | `target: migrator` | image paths | docker |
| `migrator-smoke` | `teachers-migrator:ci` | image paths | docker |

**Database paths:** `lib/db/**`, `drizzle/**`, `scripts/verify-schema.sql`.
The third is wider than the ticket's routing.

**Routing is narrower than CI, on purpose.** Every job in `ci.yml` runs on every
commit; the gate selects by path, so a docs-only change runs five checks here
and eleven there. The *table* covers CI — that is what `checks.test.ts` proves —
but a given run does not, so a green gate is a prediction over the routed subset
and silence over the rest. `gh pr checks` on the pushed head is the rest.

**Image paths:** `Dockerfile`, `docker-compose*.yml` (either compose file).

`ci: null` marks a gate-only check. `GATE_ONLY` in `checks.test.ts` lists them,
so adding one is a deliberate edit in two places.

## 3. The changed set and the tree identity

```
git diff --name-only <base>...HEAD      ∪      git status --porcelain
```

`<base>` is `origin/main` unless `--base` says otherwise. When it does not
resolve, every check runs and the run's `base` label says so. Porcelain output
is parsed by `git.ts`, never by trimming and counting characters: either status
column may be a space, so trimming the output eats the first line's.

**The tree identity** (`treeId`) is what a row is actually about:

| Working tree | `tree` |
|---|---|
| clean | the short HEAD sha, e.g. `20e0ff6` |
| dirty | `20e0ff6+<8 hex>` — a digest over `git status --porcelain -uall`, `git diff HEAD`, and the content of the untracked test files diff-hygiene reads |

The untracked content is in the digest because porcelain names such a file
without describing it: without it, deleting an `it.only` from a new test leaves
the identity unchanged, and the now-passing check is recorded as a `flake` owing
a ticket for a defect that was simply fixed. `-uall`, because plain porcelain
collapses a whole new directory to one `?? sub/` entry.

The commit alone will not do: the gate runs against the working tree, so on a
dirty tree a row naming only HEAD claims a tree that was never committed. The
identity is also what makes §6 enforceable — an edit changes it, so the attempt
count resets on the fix rather than on the commit.

## 4. `npm run gate`

| Invocation | Effect |
|---|---|
| `npm run gate` | the routed checks |
| `npm run gate -- --all` | every check |
| `npm run gate -- --only a,b` | just these; an empty list is an error, not zero checks |
| `npm run gate -- --base <ref>` | a different base |
| `npm run gate -- --ticket T-NNN` | with `--report`, the ticket the findings file must be for |
| `npm run gate -- --report` | the loop state; exit 1 while anything is open |
| `npm run gate -- --json` | the run summary as JSON |

There is deliberately **no re-run flag** — see §6.

Exit code: 0 when no check failed, 1 when one did, 2 on a bad argument, set
through `process.exitCode` rather than `process.exit()` so a large report is not
truncated on a platform with asynchronous stdout. Every selected check runs —
there is no short-circuit. The gate writes only `.gate/`.

## 5. The ledger

`.gate/ledger.jsonl`, one JSON object per line, appended:

```json
{
  "kind": "check", "run": "<iso>-<tree>", "name": "test",
  "result": "pass | fail | skipped | flake",
  "exitCode": 0, "commit": "20e0ff6", "tree": "20e0ff6",
  "branch": "claude/ticket-t-026-x",
  "at": "2026-09-09T12:00:00.000Z", "durationMs": 5900, "attempt": 1,
  "detail": "the skip reason, the refusal, or the last 40 lines of a failure"
}
```

`.gate/last-run.json` holds the same rows plus `base`, `changedPaths` and `ok`.

`result` is `skipped` — with `exitCode: null` and a `detail` saying why — when a
requirement is absent. **A skip is never a pass**, and §8 treats it as a blocker:
CI has the Docker daemon and the database the machine may not, so `gh pr checks`
on the pushed head is what clears it.

A row is appended **as each check finishes**, not in one batch at the end: a
check can throw, and a Ctrl-C during `npm run build` is ordinary, either of
which would otherwise discard the rows for everything that had already run —
several minutes of work, and the attempt counts §6 depends on.

A line that is not JSON is skipped and counted rather than thrown on. The ledger
is the loop's only memory, and losing all of it to one truncated line is a worse
failure than reporting the damage.

Two counters are derived from the rows:

- **`consecutiveFailures(name)`** — failures counting back from the latest row
  for that check, stopping at anything that is not a failure. Reaching
  `MAX_FIX_ATTEMPTS` (3) caps the check: three *different* trees have failed it.
- **`attemptFor(name, tree)`** — §6.

## 6. The flake rule

A red check gets exactly one re-run **against the same tree**, and which attempt
a run is comes from the ledger rather than from a flag:

The **episode** is the unbroken run of `fail` rows at the end of that check's
history for this tree. Anything that is not a failure — a pass, a flake, a skip
— ends one, so a check that was flaky earlier, went green and has now failed
again is starting a new episode and is owed its own re-run.

| Episode for (check, tree) | `attemptFor` | If it passes | If it fails |
|---|---|---|---|
| empty — the last row is not `fail`, or there is none | `1` | `pass` | `fail` |
| one failure, no attempt 2 in it | `2` | `flake` — a ticket is owed | `fail` |
| already contains an attempt 2 | `"capped"` | — | not run; `fail`, with the refusal in `detail` and `refused` in the table |

Keyed on the tree and not on the invocation, because that is what makes it
enforceable: an ordinary second `npm run gate` with nothing edited **is** the
re-run. An opt-in flag capped only the path a careful caller volunteered into
and left plain repetition — the thing the rule forbids — entirely uncounted.

`flake` is deliberately not `pass`: a row that says `pass` loses the fact that
the check was red once.

## 7. Findings and dispositions

`.gate/findings.json`, written by phase 7:

```json
{
  "ticket": "T-NNN",
  "rounds": [
    { "round": 1, "at": "<iso>", "commit": "abc1234", "findings": [ ... ] }
  ]
}
```

A finding always carries `id`, `file` (`path:line`), `rule` (quoted from the
document), `summary` and `source` (`contract` | `code-review` | `architecture` |
`gate`). Once disposed of it also carries exactly one evidence field:

| `disposition` | Evidence field | Validated as |
|---|---|---|
| `fixed` | `evidence` | non-empty — a commit or `file:line` |
| `rejected` | `refutation` | non-empty — the document text that refutes the rule |
| `deferred` | `ticket` | matches `^T-\d{3}$` |
| `accepted` | `acceptedNote` | non-empty |

A finding with no `disposition` is open.

## 8. Convergence and the caps

`convergence()` returns, over the rounds sorted by number:

- `counts` — findings per round, the countable form two rounds are compared in;
- `openInLastRound` — undisposed findings in the latest round;
- `converged` — `openInLastRound === 0`, no validation problem, at least one
  round. A round whose findings were all `rejected` converges;
- `cappedOut` — `MAX_REVIEW_ROUNDS` (3) reached with findings still open.

`--report` reads **only the rows for the tree that is checked out now**, because
`.gate/` outlives a branch and a ticket: without that it reports the current
ticket done on the last one's evidence. It exits 1 while any of these holds:

- no row at all for this tree;
- a routed check has no row for this tree, is red, or was skipped;
- a check has reached the fix cap **at this tree**;
- no findings file, one belonging to a different ticket than `--ticket`, or one
  recording no round at all;
- a disposition lacks its evidence, or a finding is open;
- the round cap was reached with findings still open;
- the ledger had a damaged line.

Red checks and the fix cap are both read from this tree's rows only, and redness
only for the *routed* checks: `.gate/` outlives a branch, so an abandoned
ticket's failures would otherwise cap a check on its first failure of a fresh
one, and a check run by hand with `--only` against a deliberately broken
database would wedge the loop with no way back.

## 9. `verify-schema` through a driver

`scripts/verify-schema.sql` is executed by the `postgres` package, not `psql`.
Lines whose first non-space character is a backslash are blanked — blanked, not
removed, so Postgres error positions still name the file's own line numbers.

**The constraint this places on the SQL file:** psql meta-commands are not SQL
and must carry no assertion. Everything the file asserts belongs in the `DO $$`
block, where `psql` and the driver read it the same way.

`verifySchema.test.ts` enforces that against the **raw** file, with an allowlist
of exactly one line — `\set ON_ERROR_STOP on`, which asserts nothing and whose
effect a driver has anyway. A `\gexec`, an `\if` or an `\i` fails the suite.
Asserting against the *stripped* text instead cannot work, and was the first
attempt: the strip blanks precisely the lines such an assertion looks for, so it
is empty by construction and can never fail.

## 10. The migrator smoke test

What `ci.yml`'s `images` job does, arranged to run on any platform:

1. build `--target migrator`;
2. `docker network create`, then Postgres in that network with a host port the
   OS was asked for (`listen(0)`), not a fixed one;
3. run the migrator image in the same network, addressing the database by
   container name — CI's `--network host` reaches the host rather than a
   published port on Docker Desktop;
4. verify the schema from the host over the published port, through §9;
5. tear down the container and the network, whatever happened.

The Postgres version is read from `docker-compose.yml` rather than named, so the
three files `lib/db/postgresImage.test.ts` holds in step do not become four.
