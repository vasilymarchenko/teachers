# The gate, the ledger and the review loop

**Ticket:** `docs/backlog/T-026-deterministic-ticket-loop.md`
**Status:** authoritative for T-026.

Rationale lives in `docs/architecture/decisions/ADR-011-one-gate-definition-and-a-bounded-review-loop.md`,
which references `ADR-007` (CI is the authoritative gate) and `ADR-001` (the
review reads the documents). This document adds no reasoning: it states the
check table, the routing, the ledger row shapes, the disposition vocabulary and
the caps, so `.claude/skills/**` and `scripts/gate/checks.test.ts` reference one
description instead of three.

## 1. Files

| File | Holds |
|---|---|
| `scripts/gate/checks.ts` | `CHECKS` — the single statement of the check table and its routing |
| `scripts/gate/run.ts` | the CLI: resolve the diff, select, run, record, print |
| `scripts/gate/exec.ts` | child processes; capture rather than inherit |
| `scripts/gate/ledger.ts` | `.gate/` paths, row shapes, the two counters the caps read |
| `scripts/gate/findings.ts` | findings, dispositions, convergence |
| `scripts/gate/hygiene.ts` | the diff-hygiene check |
| `scripts/gate/verifySchema.ts` | `scripts/verify-schema.sql` through the `postgres` driver |
| `scripts/gate/smoke.ts` | the two image builds and the migrator smoke test |
| `scripts/gate/report.ts` | the run table, the markdown summary, `--report` |

Tests sit beside each. `vitest.config.mts` includes `scripts/**/*.test.ts`, so
they run in `npm test` — which is itself one of the gate's checks.

## 2. The check table

Ten checks. `ci` names the step in `.github/workflows/ci.yml` the check stands
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
The third is wider than the ticket's routing; the gate may be wider than CI,
never narrower.

**Image paths:** `Dockerfile`, `docker-compose*.yml` (either compose file).

`ci: null` marks a gate-only check. `GATE_ONLY` in `checks.test.ts` lists them,
so adding one is a deliberate edit in two places.

## 3. The changed set

```
git diff --name-only <base>...HEAD      ∪      git status --porcelain
```

`<base>` is `origin/main` unless `--base` says otherwise. When it does not
resolve, every check runs and the run's `base` label says so.

## 4. `npm run gate`

| Invocation | Effect |
|---|---|
| `npm run gate` | the routed checks |
| `npm run gate -- --all` | every check |
| `npm run gate -- --only a,b` | just these |
| `npm run gate -- --base <ref>` | a different base |
| `npm run gate -- --rerun <name>` | the one permitted re-run |
| `npm run gate -- --report` | the loop state; exit 1 while anything is open |
| `npm run gate -- --json` | the run summary as JSON |

Exit code: 0 when no check failed, 1 when one did, 2 on a bad argument. Every
selected check runs — there is no short-circuit. The gate writes only `.gate/`.

## 5. The ledger

`.gate/ledger.jsonl`, one JSON object per line, appended:

```json
{
  "kind": "check", "run": "<iso>-<commit>", "name": "test",
  "result": "pass | fail | skipped | flake",
  "exitCode": 0, "commit": "abc1234", "branch": "claude/ticket-t-026-x",
  "at": "2026-09-09T12:00:00.000Z", "durationMs": 5900, "attempt": 1,
  "detail": "the skip reason, or the last 40 lines of a failure"
}
```

`.gate/last-run.json` holds the same rows plus `base`, `changedPaths` and `ok`.

`result` is `skipped` — with `exitCode: null` and a `detail` saying why — when a
requirement is absent. A skip is never a pass.

Two counters are derived from the rows:

- **`consecutiveFailures(name)`** — failures counting back from the latest row
  for that check, stopping at anything that is not a failure. Reaching
  `MAX_FIX_ATTEMPTS` (3) caps the check.
- **`mayRerun(name, commit)`** — true only when the latest row for that check
  *at that commit* is `fail` and no row for that pair has `attempt: 2`.

## 6. The flake rule

A red check gets exactly one re-run, against the same commit.

| Second attempt | Recorded as | Consequence |
|---|---|---|
| green | `flake` | a ticket is owed; `--report` names it |
| red | `fail` | a finding |
| a third | refused | the gate exits 1 with the reason |

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

`--report` exits 1 while any of these holds: a check is currently red, a check
is capped, no findings file exists, a disposition lacks its evidence, a finding
is open, or the round cap was reached with findings open.

## 9. `verify-schema` through a driver

`scripts/verify-schema.sql` is executed by the `postgres` package, not `psql`.
Lines whose first non-space character is a backslash are blanked — blanked, not
removed, so Postgres error positions still name the file's own line numbers.

**The constraint this places on the SQL file:** psql meta-commands are not SQL
and must carry no assertion. Everything the file asserts belongs in the `DO $$`
block, where `psql` and the driver read it the same way.
`verifySchema.test.ts` fails if the file grows a meta-command that survives the
strip.

## 10. The migrator smoke test

Same three steps as `ci.yml`'s `images` job, arranged to run on any platform:

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
