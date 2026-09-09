---
id: T-028
type: ticket
title: One unexplained CI integration failure, and no way to read the log that would explain it
status: todo
depends_on: [T-024]
refs:
  - .github/workflows/ci.yml
  - docs/architecture/decisions/ADR-007-ci-gate.md
---

## Goal

CI run `34327027756`, on commit `366952f` of `claude/ticket-t-026-deterministic-ticket-loop`,
failed in the `integration suite` job at the `npm run test:integration` step.
Every step before it — `npm ci`, `npm run db:migrate`, `scripts/verify-schema.sql` —
succeeded. The same suite passed against a migrated Postgres locally on the same
commit, and the next commit's run (`34328523814`) was green in all three jobs.

The cause is unknown, and could not be established, because `gh run view --log-failed`
returns `HTTP 403: Must have admin rights to Repository` and `gh run rerun`
returns `HTTP 401`. Establish what failed, and make the log reachable so the next
one does not have to be guessed at.

## Acceptance criteria

- [ ] The failure is identified, or `34327027756` is recorded as unreproducible
      with the evidence that was available.
- [ ] A CI log can be read from the terminal by whoever runs this repository —
      whether that is a token scope, a workflow that uploads the failing output
      as an artifact, or a documented route through the web UI.
- [ ] If the cause is a real flake in the integration suite, the source is named
      and either fixed or recorded in `## Notes` with what makes it flaky.

## Notes

Raised on 2026-09-09 from T-026, whose loop the failure interrupted. Two facts
about it are worth keeping:

- **It was invisible to the local gate.** `npm run gate` routes the database
  checks by path, and `366952f` touched neither `lib/db/**` nor `drizzle/**`, so
  the suite CI failed on was one the gate never selected. This is the difference
  between the check *table* covering CI and a given *run* covering it — ADR-011
  states it, and this is the incident it states it from.
- **It was not called a flake.** The one-re-run rule of T-026 distinguishes a
  flake from a red check by running the *same tree* twice. The next run was a
  different tree, so its green says nothing about this one, and no re-run of
  `366952f` was possible. "Did not recur" is what the evidence supports.
