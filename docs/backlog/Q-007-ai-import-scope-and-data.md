---
id: Q-007
type: question
title: Is AI-assisted import in scope, and may teacher data be sent to an external model
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md §10.7
  - docs/specs/specification.md §10
  - docs/specs/specification.md §11
  - docs/architecture/decisions/ADR-028-the-model-proposes-and-deterministic-code-writes.md
---

## Question

Specification §10 describes import as a future direction, and §11 says the
release has no AI features. ADR-028 proposes import through a language model:
free text, a spreadsheet or a photo becomes a proposal the teacher confirms.
Two things have to be decided before any of it is built:

1. Does import with a model move into scope, and does the specification change
   §10 and §11 to say so?
2. Which data may leave the server for an external model? A timetable,
   deadlines and event titles carry little risk. A class list (names of
   minors, birthdays, parents' phone numbers) is personal data. Its transfer
   needs a basis and probably the teacher's explicit consent on screen.

## Current default

No AI and no import: specification §11. Nothing in the code calls a model.
T-049 does not depend on this answer. T-050–T-053 do.

## Cost of changing later

Low while nothing is built. Once import exists, narrowing the data it may
send means a filter on the input and a change to the evaluation set, not to
the commands (ADR-027) or the proposal schema.

## Needed from

The product owner: the scope decision and the specification change. For the
data question: whoever answers for the school's data, if the class list is
ever to be imported.
