---
id: T-031
type: ticket
title: Pin the Node version where a developer will hit it, not only in CI
status: done
depends_on: [T-029]
refs:
  - scripts/gate/checks.ts
  - .github/workflows/ci.yml
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - CLAUDE.md
---

## Goal

Node 22 is required by the toolchain and is stated in two places that cannot
reach a developer's shell: `ci.yml`'s `node-version: 22`, which configures the
runner, and `CLAUDE.md`'s "Node.js 22+", which is prose. There is no `.nvmrc`,
no `engines` field and no check in the gate, so an older Node produces
`SyntaxError: ... does not provide an export named 'styleText'` from inside
rolldown, and `npm run gate` reports `test` and `build` as `failed` without
naming the cause. Pin the version where it is enforced or at least announced,
and make the gate say so itself.

## Acceptance criteria

- [x] `.nvmrc` holds the major version, and it agrees with `ci.yml`'s
      `node-version`. — `.nvmrc` holds `22`; `.github/workflows/ci.yml` has two
      `node-version: 22` lines (`checks`, `integration`); held in step by
      `scripts/gate/nodeVersion.ci.test.ts`.
- [x] `package.json` carries an `engines.node` range that agrees with both. —
      `package.json:5-7`, `"engines": { "node": ">=22.0.0" }`; compared in the
      same test.
- [x] `npm run gate` names a too-old Node as the reason before running any
      check, rather than letting `test` and `build` fail with the underlying
      module error. It is **not** reported as `skipped`: skipping `lint`,
      `typecheck`, `test` and `build` would empty the gate, and an empty gate
      that exits zero is the failure T-029 exists to prevent. —
      `scripts/gate/nodeVersion.ts`'s `unsupportedNodeVersion()`, called from
      `scripts/gate/index.ts`'s `run()` before `selectChecks()`; recorded as a
      single `failed` outcome named `node-version` (never `skipped`) through
      `finish()`. Verified live on this machine's actual Node 18.19.1:
      `gate: Node v18.19.1 is older than the Node 22+ this project requires
      (.nvmrc) — nvm use, or install Node 22+`, exit code 1, no other check
      attempted, and `.gate/last-run.json` recorded the real `changedFiles`
      list and the failed outcome (not stale).
- [x] A test holds the three values in step — `.nvmrc`, `engines.node` and
      `ci.yml` — in the shape `scripts/gate/checks.ci.test.ts` and
      `lib/db/postgresImage.test.ts` already use for one value across several
      files. — `scripts/gate/nodeVersion.ci.test.ts` (extended in review to
      also cover the `Dockerfile`'s four `node:22-alpine` stages, a fourth
      place named in these Notes).
- [x] `CLAUDE.md`'s "Node.js 22+" points at the pinned file rather than
      restating the number a fourth time. — `CLAUDE.md:18`, "Node version:
      `.nvmrc`." (`README.md:34`'s equivalent prerequisite line was pointed at
      `.nvmrc` too, for the same reason, though not itself a criterion here.)

## Notes

Found while reviewing PR #24 (T-029) on a machine with Node 18.19.1: `lint`,
`typecheck` and `hygiene` passed, `test` and `build` failed for the Node version
alone, and nothing in the output said so. CI was green on the same commit, so
the two disagreed for a reason the gate could not report.

This is the local-versus-CI divergence `ADR-012` is about, arriving from the
other side: the check *lists* agree, and the runtime underneath them does not.
Whether that argues for a fourth `Requirement` in `scripts/gate/checks.ts` or
for a preflight before `selectChecks()` is an implementation choice for whoever
takes this; the criteria above only require that the gate name the cause.

Containerising the development toolchain would also close it, and is not what
this ticket asks for. `docker-compose.yml` is deliberately dev-only and carries
Postgres alone; the `Dockerfile`'s `node:22-alpine` stages build the images the
VPS runs. Moving `lint`, `typecheck`, `test` and `build` into a container is a
change to how the project is developed, and would need its own ticket and an
ADR against what `docs/tech-stack.md` records.

Implemented as the preflight the Notes above left open: `unsupportedNodeVersion()`
in `scripts/gate/nodeVersion.ts`, read from `.nvmrc` and called near the top of
`scripts/gate/index.ts`'s `run()`, before any check is selected or run.
`changedFiles()` runs first, immediately above it — a plain `git diff`, safe on
any Node — because `finish()` records `changedFiles` on every run, preflight
failure included, and a hard-coded `[]` there was one of the defects self-review
found. `scripts/gate/nodeVersion.ci.test.ts` holds `.nvmrc`,
`package.json`'s `engines.node`, both `ci.yml` `node-version` lines and
the `Dockerfile`'s `node:22-alpine` stages in step, plus unit tests for the
preflight's own message. `README.md`'s prerequisite line was pointed at `.nvmrc`
alongside `CLAUDE.md`'s, for the same reason.

Self-review ran three rounds (the `reviewRounds` cap — `scripts/gate/caps.ts`;
the round-by-round findings live in the gitignored `.gate/findings.json`, so
this paragraph, not that file, is the record that survives the session), fixing
eighteen findings across them: a stale `.gate/last-run.json` on a
too-old-Node run, an unguarded `.nvmrc` read that
could crash `run()` the same way, several document-pair disagreements the
preflight introduced, and a handful of documentation wording issues; five more
findings were reviewed and rejected as re-proposals of alternatives the ticket,
`ADR-012`, or the PR's own Decisions already considered. Round 3's
`gateRunsThisRound` count went over its cap — largely from the review passes'
own verification runs against the ledger, not from re-running against an
unchanged tree — so no further `npm run gate` ran locally past that point;
`lint`, `typecheck`, `test` and `build` were each run directly and are green
under a user-space Node 22 (the machine's system Node is 18.19.1, which is what
made the preflight's own behaviour verifiable there), and `gh pr checks` on the
pushed head is the final word (`ADR-007`).

Reviewed again as `/teachers-review` on PR #25 after those rounds, on Node 22:
`npm run gate` green on all five selected checks. Four further defects were
fixed in that review — `.nvmrc`'s `v`-prefixed forms (`v22`, and the
`v22.11.0` that `node -v > .nvmrc` writes) parsed as `NaN` and failed the gate
for an unreadable `.nvmrc` on a correct machine; `dockerfileNodeMajors()`
matched only a bare-major tag, so a patch-pinned stage dropped out of the
comparison silently; `LedgerRow.exitCode`'s doc comment in
`scripts/gate/ledger.ts` still said `null` covered an in-process check, which
`hygiene` and `node-version` both contradict; and these Notes cited a
gitignored file as their evidence.
