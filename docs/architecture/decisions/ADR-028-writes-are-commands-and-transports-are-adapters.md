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
(overview §8.4), boundaries resolved at write time (§8.1), the template cut
always at `today()` (§3.2 I1), and the database constraints as the last guard.
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
  run inside one caller's transaction. Without a handle it opens its own.
- The commands that support a preview (template edits, at first) take
  `{ dryRun: true }` and return the plan they would carry out, without writing
  anything.
- No MCP endpoint and no REST API are built now. Either, when it comes, is one
  more adapter over the commands. MCP was considered and deferred for two
  reasons, recorded so that the question is not reopened blind:
  - **Reach.** Checked in October 2026, of the three main consumer assistants
    only Claude lets a free account add a custom MCP server, and only one of
    them. ChatGPT needs a paid plan for it, and Gemini's custom apps are
    limited to accounts in the US. Most of the teachers this application
    serves could not connect it.
  - **Trust.** Over MCP the teacher confirms in the assistant's own
    conversation, which the server cannot see. A write tool that defaults to
    `dryRun` is a convention the client may skip, so the guarantee of ADR-029,
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
- The refactor runs as a series, not as one change. T-050 first pins down
  with integration tests what each of the 27 write Server Actions does,
  since none had a test, so "no change in behaviour" can be checked. Then
  T-056 sets the pattern on the event writes, T-057 and T-058 move the year
  frame, the bells and the day overrides, and T-059 moves the template after
  T-043 has changed its save. T-059 also adds a test that no file in
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
