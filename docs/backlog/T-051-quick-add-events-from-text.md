---
id: T-051
type: ticket
title: Quick add — free text becomes deadlines and info events through a proposal the teacher confirms
status: todo
depends_on: [T-056, Q-007]
refs:
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
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
ADR-029. It builds the proposal pipeline end to end for the two kinds that do
not touch the template.

## Acceptance criteria

- [ ] `glossary.md` §9 states `ImportProposal` and `DateExpression` as they
      are built, and no longer as planned.
- [ ] The proposal schema (Zod, `lib/validation`) has the deadline and info
      event kinds, whose payloads are the raw inputs of the deadline and info
      event commands of T-056 (`z.input` of `deadlineInput` and
      `infoEventInput`) with each date field widened to accept a date
      expression, plus `questions` and `notUnderstood`. The model's
      structured-output schema is `z.toJSONSchema(…, { io: "input" })` of the
      proposal schema, and a test asserts that it converts.
- [ ] After the date expressions are resolved, each proposed change is passed
      to its command as raw input and parsed there with the write's own
      schema, not with a copy of it.
- [ ] Relative dates arrive as date expressions and are resolved by a pure
      function in `lib/domain` against `today()`. Unit tests with fixed
      instants cover «сьогодні», «завтра», a named weekday on that weekday
      (which resolves to today, ADR-029) and on the day after it, a day and
      month without a year on either side of 1 January within one academic
      year, and a Kyiv night after midnight that is still the previous day in
      UTC.
- [ ] An expression that resolves to nothing (no academic year set up, no
      break ahead, a day and month outside the year) is shown as a question
      asking for the date, and is not written (ADR-029).
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
- [ ] Applying a confirmed proposal is a command in `lib/commands`
      (ADR-028, ADR-029). It parses the confirmed list from scratch, resolves
      its date expressions again and checks them as below, and runs the T-056
      event commands through the T-056 helper in its commit ending. A refusal
      on any item writes nothing and names that item. The Server Action behind
      «Додати вибране» only reads the submission, calls this command and maps
      its result. It opens no transaction. The same command in the rollback
      ending is the preview that later tickets show (T-052, T-053).
- [ ] Each date on the confirmation screen comes back as its symbol and the
      date shown. The server resolves the symbol again and writes only if the
      two agree. Otherwise it writes nothing and shows the proposal again with
      the new date. A test confirms at 00:05 a proposal resolved at 23:55 the
      day before, and asserts that nothing is written and the new date is
      shown.
- [ ] `questions` and `notUnderstood` are shown as text above the list. Nothing
      in them is written.
- [ ] Unit tests cover the pipeline with the model call stubbed. An evaluation
      set of at least 20 «input → expected proposal» pairs lives in the repo
      with a script that runs it on demand. Neither the gate nor CI runs it.
- [ ] `architect-overview.md` §7 states what import is now, and ADR-029 moves
      to `accepted`.

## Notes
