# The gate command and the bounded review loop

**Ticket:** `docs/backlog/T-029-gate-command-and-bounded-loop.md`
**Status:** authoritative for T-029.

Rationale lives in `decisions/ADR-012-one-check-definition.md` and
`decisions/ADR-007-ci-gate.md`. This document adds no reasoning: it states the
mechanics — the modules, the routing table, the shape of each file under
`.gate/`, and how each of the three counts is derived.

---

## 1. The modules

| File | Holds |
|---|---|
| `scripts/gate/caps.ts` | `CAPS` — the three cap numbers. The only place they exist. |
| `scripts/gate/checks.ts` | `CHECKS`, `selectChecks()`, `unmetRequirement()` — the routing and the environment probes. |
| `scripts/gate/nodeVersion.ts` | `unsupportedNodeVersion()` — the Node-version preflight `run()` calls before selecting a check (`T-031`). |
| `scripts/gate/hygiene.ts` | `hygieneProblems()` (pure) and `runHygiene()` (reads the tree). |
| `scripts/gate/ledger.ts` | Everything that touches `.gate/`, plus `counts()`. |
| `scripts/gate/report.ts` | `table()`, `countsLine()`, `pullRequestBlock()`. |
| `scripts/gate/index.ts` | The CLI: `run()`, `finish()`, `report()`, `pullRequestChecks()`. |

Entry point: `npm run gate` → `tsx scripts/gate/index.ts`.

| Invocation | Does |
|---|---|
| `npm run gate` | Checks the Node version first (`T-031`); too old, and `run()` records that alone as one failed outcome named `node-version` and stops there. Otherwise selects checks, runs them, writes `.gate/`, prints the table and the counts. Exits non-zero if the preflight or any selected check failed. |
| `npm run gate -- --report` | Runs **no** check. Reads `.gate/last-run.json`, the counts and `gh pr checks`; exits non-zero — naming every blocker — when there is no recorded run, when the last one was red, included uncommitted work, or was against a commit other than `HEAD`, when a cap is exceeded, or when CI is not green. |
| `npm run gate -- --pr-block` | Prints the markdown block for the PR body from `.gate/last-run.json`. |

## 2. The routing

`selectChecks(changedFiles)` returns the checks in `CHECKS` declaration order,
so two runs over one change print the same table.

| Check | Pulled in by | Needs | `ci.yml` job |
|---|---|---|---|
| `lint` | every change | — | `checks` (`npm run lint`) |
| `typecheck` | every change | — | `checks` (`npm run typecheck`) |
| `test` | every change | — | `checks` (`npm test`) |
| `build` | every change | — | `checks` (`npm run build`) |
| `hygiene` | every change | — | none — see §5 |
| `db:migrate` | `DATABASE_PATHS` | `DATABASE_URL` | `integration` (`npm run db:migrate`) |
| `verify-schema` | `DATABASE_PATHS` | `DATABASE_URL`, `psql` | `integration` (anchor `scripts/verify-schema.sql`) |
| `test:integration` | `DATABASE_PATHS` | `DATABASE_URL` | `integration` (`npm run test:integration`) |
| `docker:runner` | `^Dockerfile$`, `^docker-compose*.ya?ml$` | Docker daemon | `images` (anchor `target: runner`) |
| `docker:migrator` | same | Docker daemon | `images` (anchor `target: migrator`) |
| `migrator-smoke` | same | — always skipped | `images` (anchor `teachers-migrator:ci`) |

`DATABASE_PATHS` is `^lib/db/`, `^drizzle/`, `^drizzle\.config\.ts$` and
`^scripts/verify-schema\.sql$` — stated once in `scripts/gate/checks.ts` and
named here rather than transcribed, so the two cannot drift. The last two are in
it because `ci.yml`'s `integration` job runs against both on every push: a
change to the assertion file alone, or to where the migrator points, would
otherwise run no database check locally and the full one in CI.

The changed-file set is `git diff --name-only origin/main...HEAD`, plus
`git diff --name-only HEAD` and `git ls-files --others --exclude-standard`, de-duplicated
and sorted. The uncommitted half is deliberate: the loop of §6 gates a fix
before it is committed, so a commit per attempt is not required.

`verify-schema` runs `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-schema.sql`,
argument for argument as `ci.yml` runs it — its argv is resolved at run time
because libpq does not read `DATABASE_URL` itself. There is no second
implementation of the file and it is not executed through a driver.

`migrator-smoke` carries `requires: ["ci-only"]`, so it is selected by an image
change and always reported `skipped` with its reason. Why it is not run here,
and what replaces that: `T-030`.

Environment probes run on **every** invocation and are never cached:
`DATABASE_URL` set, `command -v psql`, `docker info` exit code. `index.ts` loads
`.env` through `dotenv` first, as `drizzle.config.ts` and
`vitest.integration.config.mts` do — this project keeps `DATABASE_URL` there,
not in the shell.

## 3. Parity with `ci.yml`

`scripts/gate/checks.ci.test.ts` slices `ci.yml` from its `jobs:` line, cutting
at every two-space key with nothing after the colon. Scoped to `checks`,
`integration` and `images`; `publish` is excluded and asserted to be, via
`docker/login-action`, the step that appears only there.

- **npm scripts, both directions.** `npm run <script>` and bare `npm test`
  inside a gate job ↔ the `ciScript` of a check carrying that `ciJob`. `npm ci`
  is allowlisted by name as setup.
- **Non-npm steps, forward only.** A check may carry a `ciAnchor` — a substring
  that must appear in its job. A `run:` block is arbitrary shell and cannot be
  enumerated the other way.
- **Guards.** All four job names are found; each gate slice is non-empty; the
  slicer is exercised against a synthetic four-job workflow.

## 4. `.gate/`

Gitignored, and the only path the gate writes. It sits in the repository rather
than a session scratchpad — T-029 `## Notes`, "Two things T-026 settled".

**`ledger.jsonl`** — append-only, one line per check per run.

```json
{"runId":"2026-09-10T11:04:00.000Z-4f1a2b3c","at":"2026-09-10T11:04:31.000Z","commit":"9f2c1ab…","dirty":true,"check":"lint","result":"passed","exitCode":0}
```

`commit` is `HEAD` at the start of the run and `dirty` says whether the tree
also carried uncommitted work — the gate checks both, so the commit alone would
attribute a run to a tree it never saw.

`result` is `passed | failed | skipped`; `exitCode` is `null` for a check that
never started or ran in-process; `reason` is present on a skip. A line that does
not parse is skipped on read, never fatal.

**`last-run.json`** — `{ runId, at, commit, dirty, changedFiles, checks[] }`,
where each check is `{ name, result, exitCode, durationMs, reason?, output? }`.
`output` is stored tailed, as the terminal prints it: a check is allowed 64 MiB
and only five short fields per check are ever read back.

`--pr-block` prints the run's own `commit`, never `HEAD` at the time it runs, so
committing between the run and the paste cannot publish a run against one tree
as a statement about another. `--report` reads that same `commit` and *compares*
it with `HEAD`, blocking when they differ — gating a clean tree at A and then
committing B without re-gating would otherwise report B as checked on the
strength of A's run, and while B is unpushed `gh pr checks` is still answering
about A.

**`findings.json`** — written by `/teachers-ticket` phase 7, read by nothing but
`readRounds()`, which takes `round`, `startedAt` and `head` and ignores the rest.
Its shape and its dispositions are stated in that skill. No code validates it.

## 5. `hygiene`

Three problems over the changed-file set, each a string in the returned list;
empty is a pass. It has no CI counterpart because all three are properties of a
diff.

1. `(?:^|[\s;}])(?:describe|it|test)\.only\s*\(` in a changed `*.test.ts(x)`.
   Anchored at a statement position so a quoted mention of the form — in a test
   about this check, for one — is not itself a finding.
2. A changed path whose basename starts with `.env`, and which still exists.
   `.env.example` is exempt because it is the one that must be committed; a
   change that *deletes* an environment file is exempt because that is the fix
   rather than the problem, and flagging it would leave the author nothing they
   could do to satisfy the check.
3. `CLAUDE.md`, against two readings of it: the working tree's and
   `git show HEAD:CLAUDE.md`. The block `next dev` maintains missing from the
   working tree is a finding (it will come back); present there and absent at
   `HEAD` is a finding too (it exists only as an uncommitted change). It is
   deliberately not "is `CLAUDE.md` dirty" — the gate runs before a fix is
   committed, so an ordinary in-progress edit must not fail it.

## 6. The three counts

`counts()` returns `{ value, cap, derivation, exceeded }` per cap, and
`countsLine()` prints all three on every run.

| Count | Derived from |
|---|---|
| `reviewRounds` | `rounds.length` in `.gate/findings.json` — the one agent-written number |
| `gateRunsThisRound` | distinct `runId`s in `ledger.jsonl` with `at >= ` the current round's `startedAt` |
| `pushesAfterOpening` | entries in `git reflog show refs/remotes/origin/<branch>` newer than the one pointing at round 1's `head` |

Round 1's `head` is the commit the pull request was opened at, so every reflog
entry newer than it is a push made after the pull request existed. Counting "all
entries but the oldest" would be wrong: a clone's fetch creates the
remote-tracking ref before the opening push updates it, so the oldest entry is
the fetch, not that push.

Before phase 7 starts a round the count is 0 by definition. Where round 1's head
is not in the reflog — a fresh clone in a resumed session — it falls back to
`git rev-list --count <head>..HEAD` and prints which derivation it used; that
over-counts a push carrying two commits, and a round is meant to be one commit.
The pure part is `pushesAfterOpeningFrom()`, tested in `ledger.test.ts`.
