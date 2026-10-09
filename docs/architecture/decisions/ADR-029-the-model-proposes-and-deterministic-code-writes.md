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
  the non-teaching period. It also carries questions and a list of fragments
  the model did not understand. Anything outside the closed set lands in the
  «not understood» list and is never forced into a kind.
- A question is not free text. Each one points at one proposed change, and
  is of one of two kinds. «A date is needed» points at one date field and is
  answered with a date. «Choose one of» is answered from a closed list of
  options. Each option sets one or more fields of the change, for example «лише
  в чисельнику», which sets `target.parity` and the row's both-weeks choice
  together. The model may ask only these, and so may
  the domain: an expression that resolves to nothing raises «a date is
  needed» on its field. A few questions point at the whole proposal instead
  of one change, each «choose one of»:
  - the academic year of a list of non-teaching periods (T-061), over the
    years set up;
  - for a timetable file that does not tell the parity weeks apart, which
    weeks it is for (T-053);
  - for a timetable file, what happens to lessons the file does not show
    (T-053).

  The confirmation
  screen shows a question as an input on its change. A change with an unanswered question cannot be added until
  it is answered or unticked. The answer becomes the field's value and is
  parsed by the command like any other. The model asks no free questions.
  What it cannot place in a change goes to «not understood», quoted.
- The proposal schema is written in Zod in `lib/validation`, and it is also the
  structured-output schema given to the model (the role `docs/tech-stack.md`
  gives Zod). A proposed change's payload is the input of the command its kind
  maps to (ADR-028), `{ target, data }`, each as the raw input of its schema,
  with one widening: a date field accepts a date expression as well as a date.
  The model receives it as `z.toJSONSchema(…, { io: "input" })`; the output
  side cannot be converted, because the schemas transform strings (ADR-028).
  The resolver replaces each expression with a date, and the command parses
  the result with the write's schemas, as it parses a form's.
- The model proposes the target as well as the data: the weekday and the
  parity weeks of a template day, an override's date and lesson number, and
  the view. Nothing in a target comes from the page the input sits on, because
  import may sit on a page with no view, no day and no date. A target field
  the input does not settle becomes a question: «choose one of» for the view
  or the parity weeks, «a date is needed» for a date. It never becomes a
  default.
- A proposed template day names only the lessons the input talks about, and
  the save covers exactly those (ADR-028). «По понеділках 2-й урок математики»
  changes the second lesson and leaves the rest of Monday as it is. A removal
  is an entry with an empty lesson, and the confirmation screen shows it as a
  removal.
- A timetable from a file (T-053) is a whole week, and its scope is the
  file's grid: the weekdays it has columns for and the lesson numbers it
  has rows for. Each day of the grid is proposed with an entry for every
  lesson number of the grid, so an empty cell clears that lesson. Outside
  the grid, the file says nothing. A weekday or lesson number it has no
  place for may be a day without lessons or a part the file, or a photo of
  it, left out. Where the version in force has lessons there, one question
  for the whole proposal lists them and asks whether to remove them or to
  keep them. It is never decided by default.
- Import is a loop of rounds, not one call. Each round goes the same way:
  1. The model turns the input into a proposal.
  2. Deterministic code checks it and finds two kinds of problem. A gap is
     a field the change needs and the input did not settle. It becomes a
     question, or a fragment in «not understood». A conflict is what the
     preview finds (ADR-028): a refusal of a command, or a warning it
     carries, such as a version trimmed, a planned version ahead, or an
     existing lesson the change replaces.
  3. A gap with a closed answer (a date, a choice from a list) is answered on
     the screen, with no further model call. Anything else, «not understood»
     or a conflict the teacher wants to put differently, is answered with a
     clarification typed in the teacher's own words.
  4. A clarification starts the next round. The model receives the current
     proposal and the clarification. It returns changes only for the open
     items (an unanswered question, a fragment in «not understood», a change
     whose preview refused), plus any new change the clarification adds.
     Each change carries an id that the server gives it in the round that
     creates it, and the model answers an open item by that id.
  5. A change that is complete is frozen: every field is settled, no question
     is open, and its preview does not refuse. The server takes it from the
     previous round verbatim and ignores whatever the model returns for it.
     This guards against the model's non-determinism. A clarification about
     one item cannot quietly alter another the teacher has already checked.
     The teacher changes a frozen change only by hand, through «Виправити» in
     place, or unticks it.

  The proposal is not stored between rounds. It travels back with each
  request and is parsed again from scratch, as at confirmation. Every round
  refreshes the preview and its fingerprint. Confirmation, below, is the same
  at whatever round it comes.
- The model never produces a concrete date it had to compute. A full date it
  reads verbatim, year included («12.10.2026»), is taken as written, since the
  teacher named the year. For a single change, though, a full date before
  the anchor date raises «a date is needed», pre-filled with the date read,
  so that a mistyped year costs one look and not a silent past date. Anything
  else is a date expression, a small closed union, resolved by a pure function
  in `lib/domain` against the proposal's anchor date (below) and the year's
  rows: the relative ones
  («до п'ятниці», «щопонеділка», «до канікул») and a day and month without a
  year («12.10»), whose year is the domain's to set, not the model's.
  Recurrence boundaries reuse `boundaryKind` as it is.
- Every proposal carries an **anchor date**: `today()` at the moment the
  teacher sent its first input. In every round, each date expression of the
  proposal resolves against the anchor date, never against the time of a
  later request. «Завтра» written at 23:55 on 9 October means 10 October,
  and still does when the teacher confirms at 00:05. To a person, tomorrow
  begins after the night, not at midnight. The anchor travels with the
  proposal and, like the rest of it, is not stored. A new proposal, started
  by sending text from an empty input, gets a new anchor.
- A day and month is resolved by a rule that depends on the kind of change.
  Where that does not give a date the teacher plausibly meant, the domain
  asks instead of guessing.
  - A deadline or an info event is not tied to the academic year. It takes
    the occurrence of the day and month nearest to the anchor date, before
    or after it. If that is before the anchor date, it raises «choose one
    of»: that date, or the same day a year later. «12.10» said in May
    therefore means next October. «10.06» said in May means this June, even
    where the academic year ends on 31 May. «28.05» said on 30 May is asked
    about. None of this needs an academic year set up.
  - A day override or a timetable's start lives in the academic year. It
    takes the date inside the current academic year: the first one that has
    not ended on the anchor date. The year spans two calendar years, so a day
    and month falls in it at most once. If that date falls outside the year,
    it raises «a date is needed». If it is before the anchor date, it raises
    «choose one of»: that date, or the same day a year later.
  - A list of non-teaching periods (T-061) belongs to one academic year as a
    whole. By default that is the current one, and its dates may lie before
    the anchor date: a list of this year's holidays entered in September includes
    1 September. The confirmation screen offers the other academic years
    already set up for the whole list. A date that does not fall in the
    chosen year raises «a date is needed».
- An expression that resolves to nothing (no academic year set up, no break
  ahead, a day and month outside the year) raises «a date is needed» on its
  change, never a guess and never a silently dropped change. It is the signal
  `resolveBoundary()` already gives with `undefined`: ask for an explicit date.
- The model gets the teacher's context with the input: subjects, classes and
  teachers already entered (`getLessonSuggestions()`), the bell schedule and
  lesson numbers in use, and the anchor date and its parity. With these it
  normalises names and avoids guessing. A choice it cannot make from the input
  (both parity weeks or one, which lesson numbering) becomes a «choose one
  of» question, not a default.
- Nothing is written before the teacher confirms. The confirmed proposal comes
  back to the server as data and is parsed again from scratch. The server
  does not trust what it sent out earlier. Applying a confirmed proposal is
  itself a command in `lib/commands` (ADR-028). It parses the proposal,
  resolves its date expressions again against the anchor date, then runs
  the command of each change, all in one transaction. The
  preview on a confirmation screen is the same command with the rollback
  ending.
- The preview runs only the changes that are **ready**: ticked, with no open
  question, and not in «not understood». The screen shows every other
  change from the proposal itself, with its question inputs. A ready change
  whose command refuses in the preview shows the refusal next to it, and the
  rest of the preview stands (ADR-028). «Додати» is enabled only when every
  ticked change is ready and the preview refused none of them. The
  confirmation then sends back exactly the set the preview ran, and its
  fingerprint is the fingerprint of that set.
- A date expression travels with the proposal as an expression, and the
  screen shows the date it resolves to. Re-resolving it against the same
  anchor date gives the same date, so the passing of time changes nothing.
  Only the year's rows can change it: breaks or semesters edited between
  preview and confirmation. The outcome then differs, and the fingerprint
  below catches it. Where the row has a `boundaryKind`, the symbol is kept
  there for display, as overview §8.1 keeps it. A deadline's «до п'ятниці»
  and a start «після канікул» have no such field, and only their date is
  stored. A date the teacher edits by hand is an explicit date.
- The anchor date decides what an expression means, not what may be
  written. Each command checks a resolved date against the real `today()`
  at write time, as it checks a date typed into a form. The template is
  never cut before `today()` (overview §3.2 I1). A timetable's start «з
  сьогодні» is not an expression but `today()` at write time. After
  midnight the cut moves to the new day, the outcome differs, and the
  fingerprint shows the new preview.
- The confirmed proposal carries the fingerprint of the preview the
  confirmation screen showed (ADR-028). A write whose outcome differs from it
  writes nothing and shows the new preview. The fingerprint is the one net
  for whatever changed between preview and confirmation.
- A named weekday said on that weekday («до п'ятниці» on a Friday) resolves to
  the anchor date. The teacher sees the date on the confirmation screen and corrects it
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
