---
id: ADR-030
title: What a teacher can do now is a catalogue of scenarios, and a feature is a layer over it
status: accepted
date: 2026-10-09
ticket: T-063
---

## Context

`docs/specs/specification.md` is the idea the product started from: compact,
written before the code, and kept as that. New ideas no longer go into it. The
first one that did not fit is "import anything" (PR 54): the teacher types a
phrase, drops a file or a photo, and the application fills the data a form
would. It is described across two ADRs, two overview sections, a dozen ticket
goals and a pull request body that lives on GitHub.

No document says what a teacher can do in the application now, and what they
see at each step:

- the specification states intent, and part of it is not built (print, §7);
- `docs/demo-scenario.md` is a presenter's script for one date, ordered for a
  twenty-minute show and including setup and seed data;
- `architect-overview.md` states mechanisms, ADRs state why, tickets state work;
- the code states behaviour, but not in terms a teacher or a reviewer of an
  idea can check against.

Two costs followed. Four review runs over PR 54 kept finding new problems,
because each run invented its own teacher scenarios to walk through, so the
reviews did not converge. And a feature like import is defined as a change to
existing scenarios (a form becomes a phrase), so whoever designs or reviews it
has to reconstruct the existing ones first, differently each time.

## Options

**1. Keep the specification current.** Rewrite it as each feature lands. It
stops being the record of where the product started, and its compact,
intent-level format would have to grow step-by-step detail and edge cases it
was not written for.

**2. Extend `docs/demo-scenario.md`.** It is already Ukrainian and partly
verified in a browser. But it is ordered for a show, carries setup and seed
data, and describes one dataset on one date; a catalogue needs grouping by what
the teacher wants to do and the edge cases of each. One file cannot serve both
without breaking the demo.

**3. Scenarios per feature only.** Each feature writes the scenarios it adds.
In a brownfield product every new scenario replaces or extends an existing one
and takes its expected result from it, so each feature would reconstruct the
existing behaviour on its own, which is the divergence the reviews showed.

**4. A catalogue of current scenarios, with features as layers over it.**
`docs/scenarios/` holds what a teacher can do now; a feature's scenarios name
the catalogue entries they change, and are folded into the catalogue when the
feature is done. It costs one more living document that drifts from the code
unless something refreshes it.

## Decision

Option 4.

- `docs/scenarios/` is the catalogue of what a teacher can do in the
  application now and what they see at each step. It is written for a teacher:
  Ukrainian, no code identifiers in the prose. Scenarios are grouped by what
  the teacher wants to do, not by screen, carry ids `S-NNN` that are never
  reused, and each says how it was verified. Its conventions are
  `docs/scenarios/CLAUDE.md`.
- `docs/specs/specification.md` is the starting idea and is not updated as
  features arrive. It stays a source of intent where the code is silent.
- A feature is described in `docs/features/<slug>/`. Its scenarios are a layer
  over the catalogue that names the `S-NNN` it changes; when the feature is
  done, the layer is folded into the catalogue. The feature documents' format
  arrives with the skill that writes them.
- `/teachers-scenarios` builds and refreshes the catalogue. Where the sources
  disagree and the code cannot settle it, or where it cannot tell what a
  teacher is meant to get, it asks the user and never assumes.

## Consequences

- A review of a teacher-visible change, and the design of a new feature, has a
  fixed list of scenarios to walk instead of inventing one per run. Pointing
  `/teachers-review` at it is separate work.
- The catalogue is a second statement of behaviour the code already holds, so
  it drifts whenever a teacher-visible change merges without updating it. The
  README records the `main` commit it was last checked against, and a refresh
  run catches up from there. Until a review checks it, nothing enforces that a
  change updates its scenarios.
- Revisit if the catalogue stays behind `main` across several teacher-visible
  merges — then the refresh belongs in the ticket loop, not in a separate run —
  or if reviews keep walking scenarios that are not in it, which would mean
  the grain is wrong.
