---
id: T-031
type: ticket
title: Pin the Node version where a developer will hit it, not only in CI
status: in-progress
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

- [ ] `.nvmrc` holds the major version, and it agrees with `ci.yml`'s
      `node-version`.
- [ ] `package.json` carries an `engines.node` range that agrees with both.
- [ ] `npm run gate` names a too-old Node as the reason before running any
      check, rather than letting `test` and `build` fail with the underlying
      module error. It is **not** reported as `skipped`: skipping `lint`,
      `typecheck`, `test` and `build` would empty the gate, and an empty gate
      that exits zero is the failure T-029 exists to prevent.
- [ ] A test holds the three values in step — `.nvmrc`, `engines.node` and
      `ci.yml` — in the shape `scripts/gate/checks.ci.test.ts` and
      `lib/db/postgresImage.test.ts` already use for one value across several
      files.
- [ ] `CLAUDE.md`'s "Node.js 22+" points at the pinned file rather than
      restating the number a fourth time.

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
in `scripts/gate/nodeVersion.ts`, read from `.nvmrc` and called at the top of
`scripts/gate/index.ts`'s `run()`, before `changedFiles()` or any check.
`scripts/gate/nodeVersion.ci.test.ts` holds `.nvmrc`, `package.json`'s
`engines.node` and both `ci.yml` `node-version` lines in step, plus unit tests
for the preflight's own message. `README.md`'s prerequisite line was pointed at
`.nvmrc` alongside `CLAUDE.md`'s, for the same reason.
