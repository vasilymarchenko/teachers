---
id: ADR-028
title: Every write is a command function taking userId first; Server Actions, import and MCP are adapters over it
status: proposed
date: 2026-10-07
ticket: T-050
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

Two callers that are not forms are now in view (specification §10, overview §7):

- an import screen, where a model turns free text, a spreadsheet or a photo
  into proposed changes that the teacher confirms;
- a tool interface for AI clients (MCP), where the teacher asks their own
  assistant to enter something into the calendar.

Neither has a `FormData`, a `_prevState` or a form to echo values into. Both
need the same rules a form gets: `userId` only from the session or a token
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

**2. A REST API in Route Handlers, with the import screen and an MCP server as
its clients.** It gives one public contract. But it puts HTTP, serialisation
and a second authentication path between the app and its own database for
every caller, including the in-process import screen. And the logic would
still have to be pulled out of the Server Actions first, because the Route
Handlers cannot call them either. That makes it option 3 plus a transport
nobody has asked for yet.

**3. Pull each write's body out into a command function `(userId, input) →
result`, and make every caller an adapter over the commands.** The Server
Action keeps its signature and becomes `requireUser()` → read `FormData` →
command → `FormState`. The import screen calls the commands directly. An MCP
endpoint mounted in the same Next.js application calls them directly too. The
cost is one refactor across `lib/actions`, done once, with no change in
behaviour.

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
  view (a form, the import screen, an MCP client, a test) arrives with raw
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
- The tool interface for AI clients is an MCP endpoint served by a Route
  Handler in the same application, calling the commands and the
  `lib/db/queries` reads directly. Its write tools default to `dryRun` and
  take an idempotency key, because an AI client retries on failure and is
  expected to show the teacher the preview first. There is no REST layer
  underneath it. A REST
  API is added only when a consumer appears that MCP does not serve, and it
  calls the same commands.
- Rules that are about where `userId` comes from do not change: it comes from
  `requireUser()` in a Server Action or a page, and from the verified token in
  the MCP endpoint, and never from an input body.

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
  first. That stops being true of the commands, and is restated by T-050.
- Overview §8.2 says the schema is parsed only in the Server Action. It is
  now parsed only in the command; T-050 restates §8.2.
- A command's input is string-shaped: a test or the model passes `"45"`, not
  `45`, and `""` for an empty field. The JSON Schema of the input side says
  «string» where the rule is «a number from 10 to 90», so the model learns the
  rule from `.describe()` and the prompt, and the parse enforces it.
- A convention test asserts that `z.toJSONSchema(schema, { io: "input" })`
  converts every schema a command parses. A schema construct the input side
  cannot represent fails it before the model ever sees the schema.
- One more directory in the layout of overview §2. It is updated by T-050.
- The commands are a contract other tickets (T-051–T-054) are written against.
  Changing a command's input now costs every adapter, not one form.
- Revisit if a second deployment of the commands is needed, for example a
  separate `worker` service. The commands then move with `lib/domain` into
  whatever both processes import, and the decision stands. Revisit too if an
  external non-AI consumer appears, at which point the REST layer of option 2
  is added on top of the commands, not instead of them.
