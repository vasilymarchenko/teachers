# Review rubric

The single copy of what a review of this repository checks. Loaded by
`/review` and by `/ticket` phase 7; phase 4 reads it before planning, so code is
written against the standard it will be judged by.

**This document states no reasoning and restates no section it cites.** Every
check is a question plus the rule that answers it. To know *why* a rule exists,
open the `§` — that is where the reasoning lives, and where it stays when it
changes. A check that has grown an explanation has grown a second copy of the
architecture, and the explanation is what rots.

`§N` alone means `docs/architecture/architect-overview.md`. Other documents are
named. `.claude/skills/review/references/rubric.test.ts` asserts that every
reference below resolves.

---

## A. Contract — the diff against the ticket and the documents

- Does every acceptance criterion have a file or test that satisfies it? Name
  it. A criterion satisfied "in spirit" is not satisfied.
- Does the diff do anything no criterion asked for?
- Ticket frontmatter `status`: `done` only when every checkbox is ticked —
  `docs/backlog/CLAUDE.md`.
- Does the `README.md` row mirror the item's `id`, `title`, `status` and
  `depends_on` exactly? Any edit to those four obliges the row in the same
  commit — `docs/backlog/CLAUDE.md`.
- Does a *Blocks* entry in the questions table match the inverse `depends_on`,
  and name only items that have files?
- Is every domain term the code uses bound in `docs/architecture/glossary.md`,
  under the identifier the code spells? A term that is not there does not exist
  yet.
- Language by audience — root `CLAUDE.md`:
  - UI text, user-facing errors, seed and demo data: Ukrainian.
  - Code, identifiers, comments, commit messages, PR text, `docs/backlog/**`,
    `.claude/**`, `docs/architecture/design/**`: English.
  - `docs/architecture/*.md`: Ukrainian prose, English identifiers verbatim —
    never a translated identifier.
- Is a fact now stated in two documents? A detailed document references a
  section of the overview instead of restating it — root `CLAUDE.md`.
- If a plan was persisted under `docs/architecture/design/`, does it match what
  was built, or does its `**Status:**` line say what superseded it?

## B. Invariants — the decisions that break silently

Each of these is invisible in a diff that looks reasonable, and none of them a
general-purpose reviewer can know.

- **§8.5, root `CLAUDE.md`** — is there a `new Date()` outside `lib/time`? Is
  "today" taken from `lib/time/today.ts`? A `Date` reaching date arithmetic from
  a naive parse counts.
- **§8.4** — is `userId` the *first* parameter of every `lib/db/queries`
  function and every mutation, and does it come only from `requireUser()`? Does
  every query filter on `user_id`?
- **§8.4** — does any Zod schema declare `userId`, or any code read it from form
  or request input? Validating it does not make it trusted.
- **§3.2 I1** — does any path `UPDATE` a `ScheduleTemplate` row whose
  `validFrom` is before `today()` instead of splitting it? Is the cut point
  `today()` and not a value from the form?
- **§3.2 I2** — does creating a version truncate the previous one's `validTo`?
- **§3.2 I3** — can two versions of one `view` cover the same date? The
  constraint is in the database; does the code rely on it or duplicate it?
- **§3.2** — is a hole between versions handled as an empty calendar rather than
  an error?
- **§8.1** — is a `boundaryDate` compared exclusively (`d < boundaryDate`) while
  the `dateTo` of `AcademicYear`, `Semester`, `NonTeachingPeriod` and `Event` is
  compared inclusively? Is a symbolic boundary resolved to a date **at write
  time**, storing `boundaryKind` only for display?
- **§3.4** — does a `DayOverride` still render on a non-teaching day, by the
  `origin` rule §3.4 states? Is a `ResolvedDay` with `isNonTeaching: true` and a
  non-empty `lessons` treated as legal?
- **§3.4** — is `replacedOriginal` *absent* when there is no slot beneath a
  `SUBSTITUTION` — not `null`, not an empty payload? Is a `CLEARED` with no slot
  beneath it a no-op rather than an error?
- **§3.5** — is parity computed by the formula §3.5 gives, for every date
  including non-teaching ones? Is the week ISO, starting Monday, everywhere —
  parity, weekly view, weekly template?
- **§4, §10.6** — does `isTaughtByMe` compare `lessonNumber` **and** `subject`,
  against the expanded OWN day rather than against `TemplateSlot`?
- **§5** — is the three-source merge done once in the domain, rather than
  re-stitched in a component?
- **§2** — is pure logic in `lib/domain` (no database, no Next.js), and does
  `lib/domain` carry the tests for it?

## C. Stack — Next.js 16, Drizzle, better-auth, Zod, date-fns

- **§8.3** — does every Server Action begin `requireUser()` → Zod parse → domain
  or db → `revalidate`? Middleware is a redirect for the teacher's convenience,
  never the boundary; a missing `requireUser()` in an action is a hole, not a
  style note.
- Does a `'use client'` component import `lib/db`, `lib/auth`, or anything that
  carries a secret into the bundle?
- Is unvalidated input crossing a Server Action boundary?
- N+1: does a month or year render issue one query per day instead of one query
  per range?
- Does a new query have an index that starts with `user_id` — §8.4, and
  `docs/architecture/design/schema.md`?
- Does a `lib/db/schema` change come with a generated migration?
- **§6** — does a `/print` route stay outside the app shell layout and consume
  the same domain functions as the screen?
- Is a test asserting the implementation rather than the behaviour, or an
  expected value that was clearly read off the output instead of derived from
  `docs/architecture/design/expand-fixtures.md` or the specification?

## D. Decisions, not findings

§9 is a table of accepted compromises with the trigger that would reopen each
one; §10 records open questions, each with the default the code implements until
it is answered. Code that implements them is **correct**.

Do not report: materialising `expand()` instead of computing it on read;
replacing `@media print` with a server-side renderer; normalising the free-text
subject, class and teacher-name values into reference tables; adding recurrence
to a `DEADLINE`; adding caching; building a notification-channel or import
abstraction; building a queue or a cron.

Do report, and phrase it as the trigger: a §9 trigger that the diff has reached —
a year view now rendering past ~300 ms, an OWN/CLASS payload divergence that
wants a third view, a second real user. Also report code that contradicts a §10
default, or that implements the default in a second place instead of the one the
question names.

## E. What counts as a finding

A finding carries three things, or it is dropped:

1. **`file:line`** — where.
2. **The rule** — a `§`, an acceptance criterion, a `CLAUDE.md` rule, or a named
   stack fact. "Best practice" is not a rule.
3. **A failure scenario** — concrete inputs or state, then the wrong output,
   crash or exposure that follows. Not "this could be fragile".

A finding that cannot state a failure scenario is dropped, not softened into a
suggestion. Confident findings that turn out to be wrong are what teach a
reviewer's output to be skimmed, and a long list of maybes costs more attention
than it returns.

Rank by severity: a security or data-correctness defect, then a violated
invariant, then a broken contract with the ticket or the documents, then
reuse and simplification. Whoever runs the review reports through
`ReportFindings`, most severe first, and an empty list when nothing survives —
silence is a valid review result. A subagent has no such tool: it returns its
findings in this shape and the caller merges them.

## F. Keeping this file honest

A check that fires twice belongs in a lint rule or a convention test, not here —
the pattern `lib/auth/queryDiscipline.test.ts` and
`components/navigation/nav-items.test.ts` already
set. Promote it and delete it from this file. **This rubric is meant to shrink.**
