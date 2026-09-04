---
id: T-025
type: ticket
title: Enable branch protection on `main` so the CI gate blocks rather than reports
status: todo
depends_on: [T-024]
refs:
  - docs/architecture/decisions/ADR-007-ci-gate.md
  - .github/workflows/ci.yml
  - README.md
---

## Goal

T-024 shipped the gate and left it advisory: nothing in a commit can enable a
GitHub branch protection rule, so its third criterion could not be met there and
is carried here. Until this is done a red commit can still be merged into
`main`, exactly as PR #17 was — the failure T-024 was raised from. The settings
and why they come in a pair are in README's "Deploying to the VPS" and in
ADR-007's Consequences.

## Acceptance criteria

- [ ] A branch protection rule on `main` requires status checks to pass before
      merging, with exactly the three gate jobs selected: `lint, typecheck, unit
      tests, build`, `integration suite`, and `docker images and migrator smoke
      test`. Not `publish to GHCR` — it runs only on `main`, so requiring it
      would block every pull request on a check that never reports.
- [ ] The same rule requires *"Require branches to be up to date before
      merging"*.
- [ ] The rule is demonstrated to block: a pull request whose head commit has a
      red gate cannot be merged, and the same pull request can be merged once
      the gate is green.
- [ ] T-024's third criterion is checked, and its `## Notes` says the setting is
      enabled — in the same commit as this ticket's `status`.

## Notes

Repository configuration is not reviewable in a diff, so the third criterion is
the one that matters: the evidence is a blocked merge, not a screenshot of a
settings page.
