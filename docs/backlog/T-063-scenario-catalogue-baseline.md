---
id: T-063
type: ticket
title: Scenario catalogue — /teachers-scenarios writes down what a teacher can do now
status: in-progress
depends_on: []
refs:
  - docs/architecture/decisions/ADR-030-current-behaviour-is-a-catalogue-of-teacher-scenarios.md
  - docs/scenarios/CLAUDE.md
  - .claude/skills/teachers-scenarios/SKILL.md
  - docs/demo-scenario.md
  - docs/specs/specification.md
  - CLAUDE.md
  - docs/architecture/harness.md
---

## Goal

Write down what a teacher can do in the application now, and what they see at
each step, as the catalogue `docs/scenarios/` that ADR-030 decides on, and give
the repository a skill that builds and refreshes it from the code and a walk
through the running application, taking steps and intent from the
specification, the demo scenario and the feature layers, with the code
deciding where they disagree. This is the baseline that feature descriptions in `docs/features/`
will be layered over.

## Acceptance criteria

- [x] ADR-030 records the catalogue, the specification as the starting idea,
      and features as layers.
- [x] `docs/scenarios/CLAUDE.md` states the catalogue's format: the README and
      its frontmatter, one file per area, the scenario format with its `trace`
      comment, the five edge-case categories, the three verification labels,
      ids, the sources and what each is trusted for, completeness, and how a
      feature layer is folded in.
- [x] `.claude/skills/teachers-scenarios/SKILL.md` builds and refreshes the
      catalogue, asks the user only where the sources disagree and the code
      cannot settle it or the intent is unclear, and never records an
      invented answer.
- [x] The root `CLAUDE.md` lists `docs/scenarios/` and `docs/features/`,
      describes the specification as the starting idea, and puts both
      directories under the Ukrainian half of the language rule.
- [x] `docs/architecture/harness.md` and the document table in
      `docs/architecture/decisions/README.md` include the skill and the
      catalogue.
- [x] A first `/teachers-scenarios` run on `main` writes `docs/scenarios/`:
      every page a teacher reaches and every write a page offers appear in some
      scenario's `trace`, every scenario carries a verification label, the
      disagreements are recorded in the README, and every question the code
      could not settle has been put to the user.
- [x] `npm run gate` passes.

## Notes

- First baseline run, 2026-10-09, against `main` at 73d5023: 31 scenarios in
  six areas, all walked in a browser on the demo data against a local
  Postgres (Docker was not available). One question was put to the user —
  the calendar notice for a date outside the academic year — and answered
  as intended. Five disagreements with the specification are listed in the
  catalogue's README.
- `docs/scenarios/CLAUDE.md` gained one rule during the run: a scenario whose
  main path was walked but some steps were not keeps `у браузері <date>` and
  marks each step not walked in place.
- The review of PR 59 walked the catalogue against the deployed instance on
  2026-10-10 and found three edge cases that were false under a
  `у браузері` label: S-023 (the deployed page shows "Invalid input"), S-014
  (a last day of today is accepted), S-024 (a refusal the form cannot reach).
  The skill and `docs/scenarios/CLAUDE.md` were corrected so that edge cases
  carry their own «(у браузері не пройдено)», refusals are read from the
  condition and checked against the form component, the refresh diff covers
  `components/`, `lib/db/queries/` and `lib/time/`, and Phase 6 says which
  build to walk and which writes a shared instance allows.
