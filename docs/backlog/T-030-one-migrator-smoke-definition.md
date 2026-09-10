---
id: T-030
type: ticket
title: One migrator smoke test, called by both CI and the gate
status: todo
depends_on: [T-029]
refs:
  - .github/workflows/ci.yml
  - scripts/gate/checks.ts
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/architecture/decisions/ADR-003-migrator-image.md
---

## Goal

The `migrator-smoke` check is routed by the gate and never runs there. `ci.yml`
performs it as five `run:` steps — a throwaway Postgres, the migrator image
against it, `scripts/verify-schema.sql` again, cleanup — and T-029 declined to
transcribe that sequence into a second file, because a second orchestration that
differs from CI's does not predict CI. Move the sequence into one script that
`ci.yml` calls and the gate calls, so there is one definition and nothing to
hold in step.

## Acceptance criteria

- [ ] The sequence lives in exactly one executable file. `ci.yml`'s `images` job
      calls it; `scripts/gate/checks.ts` routes `migrator-smoke` to the same
      file, with `requires: ["docker"]` instead of `ci-only`.
- [ ] The script takes what differs between the two callers as arguments or
      environment — the port, the image tag — and hard-codes nothing that only
      one caller can satisfy.
- [ ] It cleans up its container on every exit path, as `ci.yml`'s
      `if: always()` step does now.
- [ ] `scripts/gate/checks.ci.test.ts` still holds the `images` job and the gate
      in step, and its anchor for this check names the script rather than a
      string that happens to appear in both.
- [ ] The change is proved by a CI run that is green **and** by a local run on a
      machine with a Docker daemon — the second is what T-029 could not do, and
      is the whole reason this ticket exists.
- [ ] `ADR-012`'s revisit condition names this ticket; record the outcome by
      referencing it from `## Notes`, and write a new ADR only if the unification
      turns out to change what `ADR-007` decided about the job graph.

## Notes

Split out of `T-029`, which routed the check and skipped it with a stated
reason rather than reimplementing it. The environment T-029 was implemented in
had no Docker daemon, so any script it wrote for this would have shipped
unexecuted — which is the same defect in a different place.
