---
id: ADR-028
title: Every write is a command function taking userId first; Server Actions and the import screen are adapters over it
status: proposed
date: 2026-10-07
ticket: T-056
---

## Context

Every write in the application is a Server Action in `lib/actions`. Each one
does four things in one body: reads `FormData`, validates it with a Zod schema
from `lib/validation`, writes through Drizzle, and answers in the `FormState`
shape `useActionState` expects (ADR-005). `saveTemplateDayAction()` is the
clearest case: its signature is `(view, parity, weekday, lessonNumbers,
_prevState, formData)`, and the copy-on-write machinery it calls,
`applyTemplateEdit()`, takes `formData` too, only so that a refusal can echo the
submitted values back into the form.

A caller that is not a form is now in view (specification §10, overview §7):
an import screen, where a model turns free text, a spreadsheet or a photo into
proposed changes that the teacher confirms. A second one was considered, a
tool interface for AI clients (MCP) through which the teacher's own assistant
would read and write the calendar; the Decision defers it and says why.

The import screen has no `FormData`, no `_prevState` and no form to echo values
into. It needs the same rules a form gets: `userId` only from the session
(overview §8.4), boundaries resolved at write time (§8.1), the template never
cut before `today()` (§3.2 I1; overview §10.8 allows a cut on a later date), and
the database constraints as the last guard.
The import screen also needs one transaction across several writes, so that a
timetable read from a spreadsheet becomes one template version, not six.

The repository already has this shape in one place: the teacher accounts are
five functions in `lib/auth/teachers.ts`, and the console command is one of
their callers (ADR-019).

## Options

**1. Call the Server Actions from the new callers, building a `FormData` for
them.** No refactor. But each new caller depends on form field names, which
are a UI detail and change with the UI. A Server Action is also an HTTP
endpoint whose id changes with every build, so nothing outside the app can call
it. It cannot take part in a caller's transaction, and its answer is shaped for
a form.

**2. A REST API in Route Handlers, with the import screen as its client.** It gives one public contract. But it puts HTTP, serialisation
and a second authentication path between the app and its own database for
every caller, including the in-process import screen. And the logic would
still have to be pulled out of the Server Actions first, because the Route
Handlers cannot call them either. That makes it option 3 plus a transport
nobody has asked for yet.

**3. Pull each write's body out into a command function `(userId, input) →
result`, and make every caller an adapter over the commands.** The Server
Action keeps its signature and becomes `requireUser()` → read `FormData` →
command → `FormState`. The import screen calls the commands directly. The
cost is one refactor across `lib/actions`, with no change in behaviour.

## Decision

Option 3.

- A command is a plain async function in `lib/commands/`, one file per
  aggregate, next to the `lib/actions` file it serves. Its first parameter is
  `userId` and its second is the **raw input** of the write's existing Zod
  schema, `z.input<typeof schema>`: the plain values `readDeadline()`,
  `readTemplateDay()` and the other readers already build from `FormData`
  (`{ lessonMinutes: "45", bells: [...] }`, `{ title, dateFrom, note: "" }`).
  It never reads `FormData`, never calls `requireUser()` (its caller does), and
  never calls `revalidatePath()` (that is a concern of the page cache, which
  belongs to the Server Action).
- The command is the only place the schema is parsed, once. The Server Action
  stops parsing: it reads `FormData` into the raw input and passes it on. This
  is ADR-005's rule, one place where a schema is parsed, with the place moved
  from the Server Action into the command. A schema that depends on a parameter
  (`templateDayInputFor(view)`) is chosen by the command from that parameter in
  its input. The schemas in `lib/validation` do not change.
- Why the raw input and not the parsed one. The schemas transform the form's
  strings, so their output is not their input. Measured on
  `bellScheduleInput`, `deadlineInput` and `templateDayInputFor()` on the date
  of this ADR: the output of a valid parse fails a second parse with the same
  schema (`lessonMinutes` comes out a number where the schema expects text; an
  empty `note` comes out absent where it expects a string; a template row comes
  out as `{ lessonNumber, payload }` where it expects flat fields), and
  `z.toJSONSchema()` refuses the output side of all three with «Transforms
  cannot be represented in JSON Schema». A command that took the parsed value
  could therefore not validate the unvalidated input of a caller that is not a
  form. The input side converts: `z.toJSONSchema(schema, { io: "input" })`
  works on every write schema in `lib/validation` on the same date, and it is
  what ADR-029 gives the model.
- The rejected alternative was a second, transform-free schema per write that
  the command takes and the form schema pipes into. It gives the command a
  typed signature and the model exact types, at the cost of splitting every
  schema in `lib/validation` and moving its rules and tests. Every caller in
  view (a form, the import screen, a test) arrives with raw
  values anyway, so the typed signature buys little.
- A command returns either success or a refusal. A refusal has a
  machine-readable `code`, an optional `field`, and the Ukrainian `message` the
  form already shows. The `field` is the issue's path in the raw input
  (`bells.3.timeFrom`, `entries.0.subject`), the same path the form's error
  mapping reads today. The command does not return `FormState`; the Server
  Action maps the refusal onto it, through `bellFieldErrors()`,
  `templateDayFieldErrors()` and the other mappings it already has.
- A command accepts an optional database handle, so that several commands can
  run inside one caller's transaction. Without a handle it opens its own. The
  handle carries the command's **reads** as well as its writes: every
  `lib/db/queries` function a command calls takes the handle as an optional last
  parameter (`userId` stays first). A command that read through `getDb()` would
  read on another connection and not see what an earlier command in the same
  transaction wrote. The template day save is where that bites: two day saves
  in one transaction must plan the second against the version the first
  created (a `replace`), not against the version committed before both.
- One helper in `lib/commands` runs a caller's commands in one transaction
  and ends it in one of two ways: a commit, or a rollback after the
  resulting state has been read through the same handle. A write is the
  commit ending. A preview is the rollback ending of the same call. No
  command has a separate dry-run mode.
- A preview returns the outcome it shows as a description: the versions with
  their ranges, the lessons by day and the events, in a fixed order and
  without generated ids or timestamps. It also returns a fingerprint of that
  description. A write may carry the fingerprint of the preview the teacher
  saw. The helper then builds the same description from the same transaction
  before committing. If the fingerprints differ, it rolls back and returns a
  refusal that carries the new preview. The check does not enumerate what
  may have changed in between: midnight, a template edited in another window,
  breaks or bells edited meanwhile. It catches any of them, because each one
  changes the outcome. A preview of several
  commands then composes exactly as their write does, and it meets the same
  refusals, the database constraints included. A per-command dry run was
  rejected: each one plans against the database as committed, so the second
  of two would preview a trim and a new version where the write does a
  `replace`, and the preview would show a result the write never produces.
- A write that spans several commands is itself a command. It does more than
  call them in turn: confirming an import proposal parses it, checks it, and
  then runs the commands of its changes. That work belongs in `lib/commands`,
  not in the Server Action that receives the form. The Server Action stays an
  adapter that opens no transaction, so the test that no file in
  `lib/actions` writes to the database (T-059) holds for the import screens
  as well. Such a command runs its parts through the helper above. Its
  preview is the same command with the rollback ending, so the preview and
  the write are one code path.
- No MCP endpoint and no REST API are built now. Either, when it comes, is one
  more adapter over the commands. MCP was considered and deferred for two
  reasons, recorded so that the question is not reopened blind:
  - **Reach.** Checked in October 2026, of the three main consumer assistants
    only Claude lets a free account add a custom MCP server, and only one of
    them. ChatGPT needs a paid plan for it, and Gemini's custom apps are
    limited to accounts in the US. Most of the teachers this application
    serves could not connect it.
  - **Trust.** Over MCP the teacher confirms in the assistant's own
    conversation, which the server cannot see. A write tool that previews
    by default is a convention the client may skip, so the guarantee of ADR-029,
    that nothing is written the teacher has not seen, would not hold. The
    token carries all of the teacher's rights, including against instructions
    injected into whatever the assistant reads.
  If MCP is taken up again, it starts read-only. Writes over it need their own
  ADR choosing a confirmation the server enforces, for example a draft the
  teacher confirms in the application.
- Rules that are about where `userId` comes from do not change: it comes from
  `requireUser()` in a Server Action or a page, never from an input body.

## Consequences

- Writes become callable from tests without `FormData`. That makes the
  copy-on-write paths testable as functions, not only through forms.
- Every new caller gets I1, I2, I3, §8.1 and §8.4 by construction. No adapter
  can reach Drizzle on a path that skips them.
- `lib/actions` gets thinner. Each Server Action becomes a short adapter. Both
  static checks that scan for writes move with them: the T-022 convention test
  (every UPDATE checks the rows it matched) and the §8.4 check in
  `lib/auth/queryDiscipline.test.ts` have to scan `lib/commands` as well.
- The `lib/db/queries` functions a command calls gain an optional handle as
  their last parameter. The pages keep calling them without one.
- Overview §8.4 and the root `CLAUDE.md` say a mutation cannot take `userId`
  first. That stops being true of the commands, and is restated by T-056.
- Overview §8.2 says the schema is parsed only in the Server Action. It is
  now parsed only in the command; T-056 restates §8.2.
- A command's input is string-shaped: a test or the model passes `"45"`, not
  `45`, and `""` for an empty field. The JSON Schema of the input side says
  «string» where the rule is «a number from 10 to 90», so the model learns the
  rule from `.describe()` and the prompt, and the parse enforces it.
- A convention test asserts that `z.toJSONSchema(schema, { io: "input" })`
  converts every schema a command parses. A schema construct the input side
  cannot represent fails it before the model ever sees the schema.
- One more directory in the layout of overview §2. It is updated by T-056.
- The refactor runs as a series, not as one change. Integration tests first
  pin down what each of the 27 write Server Actions does, since none had a
  test, so "no change in behaviour" can be checked: T-050 for the 24 outside
  the template, and T-060 for the three template ones once T-043 has changed
  their save, so that they are written once and against the save that moves.
  Then T-056 sets the pattern on the event writes, T-057 and T-058 move the
  year frame, the bells and the day overrides, and T-059 moves the template. T-059 also adds a test that no file in
  `lib/actions` writes to the database. The two styles live side by side
  only while the series runs, and the test stops them from doing so after
  it.
- The commands are a contract other tickets (T-051–T-053) are written against.
  Changing a command's input now costs every adapter, not one form.
- Revisit if a second deployment of the commands is needed, for example a
  separate `worker` service. The commands then move with `lib/domain` into
  whatever both processes import, and the decision stands. Revisit too if an
  external non-AI consumer appears, at which point the REST layer of option 2
  is added on top of the commands, not instead of them.
