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
| `scripts/gate/hygiene.ts` | `hygieneProblems()` (pure) and `runHygiene()` (reads the tree). |
| `scripts/gate/ledger.ts` | Everything that touches `.gate/`, plus `counts()`. |
| `scripts/gate/report.ts` | `table()`, `countsLine()`, `pullRequestBlock()`. |
| `scripts/gate/index.ts` | The CLI: `run()`, `report()`, `pullRequestChecks()`. |

Entry point: `npm run gate` → `tsx scripts/gate/index.ts`.

| Invocation | Does |
|---|---|
| `npm run gate` | Runs the selected checks, writes `.gate/`, prints the table and the counts, exits non-zero if any check failed. |
| `npm run gate -- --report` | Runs **no** check. Reads the counts and `gh pr checks`; exits non-zero when a cap is exceeded or CI is not green, naming which. |
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
| `db:migrate` | `^lib/db/`, `^drizzle/` | `DATABASE_URL` | `integration` (`npm run db:migrate`) |
| `verify-schema` | `^lib/db/`, `^drizzle/` | `DATABASE_URL`, `psql` | `integration` (anchor `scripts/verify-schema.sql`) |
| `test:integration` | `^lib/db/`, `^drizzle/` | `DATABASE_URL` | `integration` (`npm run test:integration`) |
| `docker:runner` | `^Dockerfile$`, `^docker-compose*.ya?ml$` | Docker daemon | `images` (anchor `target: runner`) |
| `docker:migrator` | same | Docker daemon | `images` (anchor `target: migrator`) |
| `migrator-smoke` | same | — always skipped | `images` (anchor `teachers-migrator:ci`) |

The changed-file set is `git diff --name-only origin/main...HEAD`, plus
`git diff --name-only HEAD` and `git ls-files --others --exclude-standard`, de-duplicated
and sorted. The uncommitted half is deliberate: the loop of §6 gates a fix
before it is committed, so a commit per attempt is not required.

`verify-schema` runs `psql -v ON_ERROR_STOP=1 -f scripts/verify-schema.sql` —
the file CI runs, through the tool CI runs it with. There is no second
implementation of it, and it is not executed through a driver.

`migrator-smoke` is routed but never runs locally: CI performs it as a five-step
orchestration (a throwaway Postgres on 5433, the migrator image against it,
`verify-schema.sql` again, cleanup), and transcribing that into a second file is
the local reimplementation T-029 rules out. It appears in every table as
`skipped` with its reason, so a change to the images is never reported as fully
checked here. `T-030` unifies the two into one script called by both.

Environment probes run on **every** invocation and are never cached:
`DATABASE_URL` set, `command -v psql`, `docker info` exit code. An environment
fix changes no file, so a remembered answer would keep refusing a check the
developer had just repaired.

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

Gitignored, and the only path the gate writes. In the repository rather than a
session scratchpad: a human running `npm run gate` has no scratchpad path, and a
fresh session could not find the previous one.

**`ledger.jsonl`** — append-only, one line per check per run.

```json
{"runId":"2026-09-10T11:04:00.000Z-4f1a2b3c","at":"2026-09-10T11:04:31.000Z","commit":"9f2c1ab…","check":"lint","result":"passed","exitCode":0}
```

`result` is `passed | failed | skipped`; `exitCode` is `null` for a check that
never started or ran in-process; `reason` is present on a skip. A line that does
not parse is skipped on read, never fatal.

**`last-run.json`** — `{ runId, at, commit, changedFiles, checks[] }`, where each
check is `{ name, result, exitCode, durationMs, reason?, output? }`.

**`findings.json`** — written by `/teachers-ticket` phase 7, read by nothing but
`readRounds()`, which takes `round`, `startedAt` and `head` and ignores the rest.
Its shape and the four dispositions are stated in that skill. **No code
validates it**: a validator can check that a field is not empty, never that it
is true.

## 5. `hygiene`

Three problems over the changed-file set, each a string in the returned list;
empty is a pass. It has no CI counterpart because all three are properties of a
diff.

1. `(?:^|[\s;}])(?:describe|it|test)\.only\s*\(` in a changed `*.test.ts(x)`.
   Anchored at a statement position so a quoted mention of the form — in a test
   about this check, for one — is not itself a finding.
2. A changed path whose basename starts with `.env` — `.env.example` exempt.
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
| `pushesAfterOpening` | entries in `git reflog show refs/remotes/origin/<branch>`, minus the first |

The push count falls back to `git rev-list --count <round 1 head>..HEAD` when
the reflog is empty — a fresh clone in a resumed session — and prints which
derivation it used. A fetch that moves the remote-tracking ref also lands in
that reflog, so the count can over-report on a branch someone else pushes to;
anything exact would need a record the agent writes itself, which is what the
ticket rules out.
