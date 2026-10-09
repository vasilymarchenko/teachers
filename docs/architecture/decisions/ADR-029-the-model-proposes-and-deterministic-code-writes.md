---
id: ADR-029
title: In import, a model proposes typed changes and deterministic code resolves and writes them; dates arrive as symbols
status: proposed
date: 2026-10-07
ticket: T-051
---

## Context

Specification §10 describes import in two steps: read the input and understand
what is in it, then lay it out onto the calendar with the teacher's
confirmation. The inputs now in view are arbitrary: a line of text («по
понеділках 2-й урок математики у 7-Б», «до п'ятниці звіт директору»), a
spreadsheet with a timetable, a photo of one. Only a language model reads
inputs of that range. A model's output is not deterministic, and it is not
reliable about dates, which is the one thing every write in this application
turns on.

The write paths already have their rules. Boundaries are entered as symbols and
resolved at write time (overview §8.1). «Today» comes only from
`lib/time/today.ts` in `Europe/Kyiv` (§8.5). The template is never cut before
`today()`, so the past is never edited (§3.2; overview §10.8 allows a cut on a
later date). After ADR-028, these rules live in command
functions that any caller can use.

## Options

**1. Give the model tools that write.** Each tool is a command, and the model
calls them as it understands the input. It needs the fewest parts, but nothing
stands between a misreading and the database. The teacher sees the result only
after it has been written, and the model computes concrete dates itself, so
«до п'ятниці» on a Thursday evening in UTC is a day off.

**2. The model returns a typed proposal; the teacher confirms it; the server
re-validates the confirmed proposal and applies it through the commands.** Dates
in the proposal are symbols («next Friday», «weekday 1», «until the end of the
semester»), resolved by `lib/domain` against `today()`. It needs more parts: a
proposal schema, a resolver for date symbols, and a confirmation screen. But no
write ever depends on the model having been right.

**3. No model: deterministic parsers for known formats** (a CSV with fixed
headers, a fixed phrase grammar). It is predictable, but it covers none of the
inputs that motivated the feature. It remains a possible fallback for a known
spreadsheet layout, not the mechanism.

## Decision

Option 2.

- The model's whole output is an import proposal: a list of proposed changes,
  each one of a closed set of kinds that map one-to-one onto commands (a
  deadline, an info event, the lessons of one template day, a day override, a
  non-teaching period, bell times). Each kind is built by a ticket: T-051 the
  events, T-052 the template day and the override, T-053 the bell times, T-061
  the non-teaching period. It also carries a list of questions for
  anything ambiguous, and a list of fragments the model did not understand.
  Anything outside the closed set lands in the «not understood» list and is
  never forced into a kind.
- The proposal schema is written in Zod in `lib/validation`, and it is also the
  structured-output schema given to the model (the role `docs/tech-stack.md`
  gives Zod). A proposed change's payload is the raw input of the command its
  kind maps to (ADR-028), `z.input` of that write's schema, with one widening:
  a date field accepts a date expression as well as a date. The model receives
  it as `z.toJSONSchema(…, { io: "input" })`; the output side cannot be
  converted, because the schemas transform strings (ADR-028). The resolver
  replaces each expression with a date, and the command parses the result with
  the write's schema, as it parses a form's.
- The model never produces a concrete date it had to compute. A full date it
  reads verbatim, year included («12.10.2026»), is passed through. Anything
  else is a date expression, a small closed union, resolved by a pure function
  in `lib/domain` against `today()` and the year's rows: the relative ones
  («до п'ятниці», «щопонеділка», «до канікул») and a day and month without a
  year («12.10»), whose year is the domain's to set, not the model's. A day and
  month resolves to that date inside the first academic year that has not
  ended on `today()`. Recurrence boundaries reuse `boundaryKind` as it is.
- An expression that resolves to nothing (no academic year set up, no break
  ahead, a day and month outside the year) becomes a question to the teacher,
  never a guess and never a silently dropped change. It is the signal
  `resolveBoundary()` already gives with `undefined`: ask for an explicit date.
- The model gets the teacher's context with the input: subjects, classes and
  teachers already entered (`getLessonSuggestions()`), the bell schedule and
  lesson numbers in use, and the current date and parity. With these it
  normalises names and avoids guessing. A choice it cannot make from the input
  (both parity weeks or one, which lesson numbering) becomes a question, not a
  default.
- Nothing is written before the teacher confirms. The confirmed proposal comes
  back to the server as data and is parsed again from scratch. The server
  does not trust what it sent out earlier. Applying a confirmed proposal is
  itself a command in `lib/commands` (ADR-028). It parses the proposal,
  resolves its date expressions again and compares them with the dates
  shown, then runs the command of each change, all in one transaction. The
  preview on a confirmation screen is the same command with the rollback
  ending.
- A resolved date travels back with its symbol. Each date the confirmation
  screen showed, from a date expression or from a boundary symbol
  («до кінця семестру», «після канікул»), comes back as the pair: the symbol,
  and the date the teacher saw. The server resolves the symbol again at write
  time and compares. If the two agree, it writes. Where the row has a
  `boundaryKind`, the symbol is kept there for display, as overview §8.1 keeps
  it. A deadline's «до п'ятниці» and a start «після канікул» have no such
  field, and only their date is stored. If they differ, because
  midnight passed or the year's breaks were edited meanwhile, it writes
  nothing and shows the proposal again with the new date. Re-resolving alone
  could write a date the teacher never saw, and sending the date alone would
  lose the symbol the screen shows. The pattern is the one the template
  editor already follows when a version changed in another window.
- A named weekday said on that weekday («до п'ятниці» on a Friday) resolves to
  today. The teacher sees the date on the confirmation screen and corrects it
  there if next week was meant.
- The proposal is not stored. It lives in the request and on the confirmation
  screen. A table for drafts appears only with asynchronous processing (a
  `worker`, `docs/tech-stack.md`).
- The model call is the only network dependency the feature adds. The code
  around it is unit-tested with the call stubbed. A separate evaluation set of
  «input → expected proposal» pairs is run by hand, not by the gate or CI: it
  is non-deterministic and it costs money.

## Consequences

- A misreading costs the teacher one correction on the confirmation screen,
  never a wrong row. The guarantee holds because the confirmation screen is
  the application's own. It is the reason an MCP endpoint is deferred
  (ADR-028): there the confirmation would happen in the assistant's
  conversation, where the server cannot see it.
- Relative dates are tested like every other date in the domain, with fixed
  instants, and are never wrong by the UTC/Kyiv offset.
- The closed set of kinds is the feature's scope. Students and birthdays are
  not in it until `Student` exists (second-phase work, specification §9,
  overview §7), and adding a kind is adding a
  command and a schema, not teaching the model something.
- This needs the product decision of Q-007: the specification currently
  excludes AI from the release (§11), and teacher data goes to an external
  model.
- Revisit if the confirmation step proves to be friction the teacher skips by
  reflex for one kind of change. Auto-applying that one kind is then a separate
  decision with its own ADR, not a relaxation of this one.
