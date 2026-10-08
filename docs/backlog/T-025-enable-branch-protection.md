---
id: T-025
type: ticket
title: Enable branch protection on `main` so the CI gate blocks rather than reports
status: done
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

- [x] A branch protection rule on `main` requires status checks to pass before
      merging, with exactly the three gate jobs selected: `lint, typecheck, unit
      tests, build`, `integration suite`, and `docker images and migrator smoke
      test`. Not `publish to GHCR` — it runs only on `main`, so requiring it
      would block every pull request on a check that never reports.
- [x] The same rule requires *"Require branches to be up to date before
      merging"*.
- [x] The rule is demonstrated to block: a pull request whose head commit has a
      red gate cannot be merged without an explicit admin bypass, and the same
      pull request can be merged once the gate is green.
- [x] T-024's third criterion is checked, and its `## Notes` says the setting is
      enabled — in the same commit as this ticket's `status`.

## Notes

Repository configuration is not reviewable in a diff, so the third criterion is
the one that matters: the evidence is a blocked merge, not a screenshot of a
settings page.

The rule, read back through the GitHub API on 2026-10-08: pattern `main`,
matching the `main` branch; required checks exactly the three gate jobs, each
bound to the `github-actions` app; `strict` (up to date) on; a pull request
required, with 0 approvals; force pushes and deletion blocked.

The demonstration is PR #57, which closes this ticket:

- Head `9cc6aaf` added a deliberately failing unit test. The gate went red, the
  pull request was `BLOCKED`, and the merge box offered no normal merge — only
  the admin "bypass rules" checkbox, which was not used.
- Head `a8e5dc6` removed the test. All three required checks passed and the
  branch was up to date with `main`, so nothing in the rule held the merge back.
  Merging PR #57 itself is the final proof.

Decided while doing it: no required approvals, and the admin bypass left on.
README's "Deploying to the VPS" records both settings and why.

ADR-016's revisit trigger — branch protection making `checks` a required status
— fired here. Option 3 stands: `ci.yml` runs every job on every push, so every
required check reports on every pull request, documentation-only ones included.
