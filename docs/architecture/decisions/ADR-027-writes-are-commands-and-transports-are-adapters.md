---
id: ADR-027
title: Every write is a command function taking userId first; Server Actions, import and MCP are adapters over it
status: proposed
date: 2026-10-07
ticket: T-049
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
  `userId` and its second is an already-typed input: the output type of the
  same Zod schema the form uses. It never reads `FormData`, never calls
  `requireUser()` (its caller does), and never calls `revalidatePath()` (that
  is a concern of the page cache, which belongs to the Server Action).
- A command validates its input itself with the same schema, because callers
  other than a form arrive with unvalidated data. A form caller pays for a
  second parse of an already-parsed object, which is negligible.
- A command returns either success or a refusal. A refusal has a
  machine-readable `code`, an optional `field`, and the Ukrainian `message` the
  form already shows. It does not return `FormState`; the Server Action maps
  the refusal onto `FormState`.
- A command accepts an optional database handle, so that several commands can
  run inside one caller's transaction. Without a handle it opens its own.
- The commands that support a preview (template edits, at first) take
  `{ dryRun: true }` and return the plan they would carry out, without writing
  anything.
- The tool interface for AI clients is an MCP endpoint served by a Route
  Handler in the same application, calling the commands and the
  `lib/db/queries` reads directly. There is no REST layer underneath it. A REST
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
- `lib/actions` gets thinner. Each Server Action becomes a short adapter, and
  the convention test of T-022 (every UPDATE checks the rows it matched) has to
  be pointed at `lib/commands` as well.
- One more directory in the layout of overview §2. It is updated by T-049.
- The commands are a contract other tickets (T-050–T-053) are written against.
  Changing a command's input now costs every adapter, not one form.
- Revisit if a second deployment of the commands is needed, for example a
  separate `worker` service. The commands then move with `lib/domain` into
  whatever both processes import, and the decision stands. Revisit too if an
  external non-AI consumer appears, at which point the REST layer of option 2
  is added on top of the commands, not instead of them.
