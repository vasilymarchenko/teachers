---
id: T-050
type: ticket
title: Quick add — free text becomes deadlines and info events through a proposal the teacher confirms
status: todo
depends_on: [T-049, Q-007]
refs:
  - docs/architecture/decisions/ADR-028-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/decisions/ADR-027-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/lesson-input-and-import.md §7
  - docs/specs/specification.md §6.3
  - docs/specs/specification.md §10
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/architect-overview.md §8.5
  - docs/tech-stack.md
---

## Goal

The teacher types one or more lines such as «до п'ятниці звіт директору» or
«щочетверга нарада до кінця семестру» into one input. They see what the
application understood as a list of proposed deadlines and info events, change
or untick any of them, and add the rest in one step. This is the first slice of
ADR-028. It builds the proposal pipeline end to end for the two kinds that do
not touch the template.

## Acceptance criteria

- [ ] `glossary.md` §9 states `ImportProposal` and `DateExpression` as they
      are built, and no longer as planned.
- [ ] The proposal schema (Zod, `lib/validation`) has the deadline and info
      event kinds with the payloads of `deadlineInput` and `infoEventInput`,
      plus `questions` and `notUnderstood`. The same schema is the model's
      structured-output schema.
- [ ] Relative dates arrive as date expressions and are resolved by a pure
      function in `lib/domain` against `today()`. Unit tests with fixed
      instants cover «сьогодні», «завтра», a named weekday on that weekday and
      on the day after it, and a Kyiv evening that is already the next day in
      UTC.
- [ ] The model is called from one module that is the only importer of
      `@anthropic-ai/sdk`. The API key comes from the environment, and its
      absence hides the input rather than failing a page. Calls are limited per
      teacher, with a timeout. The model output is parsed with the schema, and
      a parse failure is shown as «не вдалося розібрати», never as a partial
      write.
- [ ] The confirmation screen lists each proposed change with the resolved
      date in words. Each one can be unticked, and «Виправити» opens the
      existing event form pre-filled. «Додати вибране» sends the confirmed list
      back.
- [ ] The server parses the confirmed list from scratch and applies it through
      the T-049 event commands in one transaction. A refusal on any item writes
      nothing and names that item.
- [ ] `questions` and `notUnderstood` are shown as text above the list. Nothing
      in them is written.
- [ ] Unit tests cover the pipeline with the model call stubbed. An evaluation
      set of at least 20 «input → expected proposal» pairs lives in the repo
      with a script that runs it on demand. Neither the gate nor CI runs it.
- [ ] `architect-overview.md` §7 states what import is now, and ADR-028 moves
      to `accepted`.

## Notes
