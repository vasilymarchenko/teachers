---
id: T-064
type: ticket
title: Feature idea — /teachers-idea turns a raw idea into an agreed idea.md through an interview
status: done
depends_on: [T-063]
refs:
  - docs/features/CLAUDE.md
  - .claude/skills/teachers-idea/SKILL.md
  - docs/architecture/decisions/ADR-030-current-behaviour-is-a-catalogue-of-teacher-scenarios.md
  - docs/scenarios/CLAUDE.md
  - .claude/skills/teachers-scenarios/SKILL.md
  - docs/specs/specification.md
  - docs/architecture/glossary.md
  - CLAUDE.md
  - docs/architecture/harness.md
  - docs/architecture/decisions/README.md
---

## Goal

Give a feature its first document, `docs/features/<slug>/idea.md`, and give the
repository a skill that writes it. `/teachers-idea` takes the user's raw idea
verbatim, reads what the repository already answers — the specification, the
scenario catalogue, the architecture, the backlog — and interviews the user on
the rest until the idea is agreed: the problem, what changes for the teacher and
what does not, what the teacher will see when it works, the boundaries, the
simpler paths considered and rejected, the risks a reviewer with no stake in the
idea finds, and the questions left open. The idea is finalised in the interview,
not reconstructed later by a reviewer. The feature's scenarios, written over the
catalogue from this document, are separate work.

## Acceptance criteria

- [x] `docs/features/CLAUDE.md` (English, for the agent) states the feature
      directory's convention: the layout of `docs/features/<slug>/` and how a
      slug is chosen; the frontmatter of `idea.md`, including a status that
      says whether the idea is agreed or done — the «marked done» that
      `docs/scenarios/CLAUDE.md` and `/teachers-scenarios` read — and where
      it is read from that a feature is being built; the sections of `idea.md` and what each holds; the language rule
      (Ukrainian, for a teacher, product terms from the glossary; the raw idea
      kept verbatim in whatever language it was given); where an open question
      of the idea lives and when it becomes a backlog `Q-NNN`; and what may
      change in `idea.md` once it is agreed.
- [x] `idea.md` has these sections, in this order: the raw idea, verbatim; the
      problem, with no solution in it; the idea after the interview, with what
      changes for the teacher and what does not; what the teacher will get —
      criteria a teacher can observe; the boundaries — what is out of scope;
      the rejected paths, each with the reason it was rejected; the risks; the
      open questions. Delivery order appears only as an order a teacher can
      see; technical layers belong to the design, not to the idea.
- [x] `.claude/skills/teachers-idea/SKILL.md` holds the method only, and every
      rule about the document is in `docs/features/CLAUDE.md`. The method:
  - the raw idea is recorded verbatim before any question is asked;
  - the documents are read first, and nothing they answer is asked — the
    question cites the document instead;
  - the interview goes in batches of two or three questions, over the problem,
    the validation of the solution, the success criteria, the constraints and
    the fit with what the application already does, and each new intent is
    tied to the catalogue scenarios it changes;
  - the skill proposes one or two simpler paths; the ones the user rejects go
    to the rejected paths with the user's reason;
  - the risks come from a subagent dispatched with the idea and the documents
    only — not the interview, not the skill's own assessment;
  - every word in the teacher-facing sections passes the audience test, with
    `docs/architecture/glossary.md` as the list of allowed product terms;
  - nothing is written to the repository until the user confirms the final
    text, no question is asked after it is written, and an answer is never
    invented — an unanswered question goes to the open questions;
  - the document stays within a word budget the convention states.
- [x] The skill carries the `teachers-` prefix, and its description says when
      to use it and what it does not do (the scenarios, the design, the
      tickets).
- [x] The root `CLAUDE.md` document list describes `docs/features/` by its
      convention and its skill, instead of saying the format is still to come.
- [x] `docs/architecture/harness.md` lists the skill and the feature
      directory wherever it lists `/teachers-scenarios` and the catalogue, and
      the document table in `docs/architecture/decisions/README.md` has a row
      for `docs/features/`.
- [x] An ADR is recorded only if building this chooses between real
      alternatives that ADR-030 did not already decide.
- [x] `npm run gate` passes.

## Notes

- Statuses of `idea.md` are `agreed | done`, not a longer lifecycle: the
  skill writes the file only after the user confirms its text, so a draft never
  reaches the repository, and whether a feature is being built is read from the
  backlog. Criterion 1 was narrowed from four states to two during the work,
  on the user's decision. The interview has one depth, not the easy/medium/hard dial of the
  sample interview skill it was adapted from.
- New product terms go into a new glossary §9 with no identifier, following the
  precedent of §6 (second-phase terms); the design fills the identifier.
- An open question stays in `idea.md` and becomes a `Q-NNN` only when a ticket
  has to wait on it.
- No ADR: ADR-030 already chose `docs/features/` as the home of a feature, and
  nothing built here chose between real alternatives beyond it.
- `npm run gate` cannot start lint and typecheck on Windows (it spawns `npm`
  without a shell, and Windows names it `npm.cmd`); both were run directly and
  pass, and hygiene passed in the gate. The gate defect is outside this ticket;
  the gate criterion is ticked on CI's verdict (ADR-007): `ci.yml` green on
  PR 61 at 6c940a8.
