---
name: teachers-scenarios
description: Build or refresh docs/scenarios/ — the catalogue of what a teacher can do in the application now and what they see at each step — from the specification, the demo scenario and the feature layers, with the code deciding where they disagree. It runs without a formal interview and asks the user only where the sources disagree and the code cannot settle it, or where it cannot tell what a teacher is meant to get. Use when the user invokes /teachers-scenarios (baseline is the only mode so far), asks to "build the scenario catalogue", "refresh the scenarios", "write down what a teacher can do now", or when an idea, a design or a review needs the current behaviour written down first.
---

# Scenarios

**The catalogue's format and rules are `docs/scenarios/CLAUDE.md`; why it
exists is `ADR-030`.** This file is the method only: how to find what to
describe, how to resolve the sources, when to ask, and how to check the result.
A rule about the catalogue that appears here and not there is a bug in this
file.

The catalogue describes what **is**. Every sentence in it must be something the
application does today, or be marked as not checked. Writing down what the
application should do, because a document says so or because it would be
sensible, is the one failure this skill exists to prevent.

## Phase 1 — Resolve the run

- **Mode.** `/teachers-scenarios` and `/teachers-scenarios baseline` are the
  same. Any other mode: say it does not exist yet and stop.
- **Build or refresh.** No `docs/scenarios/README.md` on `origin/main`: build.
  Otherwise refresh from its `base` commit.
- **Branch.** The catalogue is a direct change (root `CLAUDE.md`, "A ticket
  run, or a direct change"). On `main`, or on a branch carrying unrelated work,
  cut `docs/scenarios-<YYYY-MM-DD>` from `origin/main`. Everything read before
  the branch is cut is read from `origin/main` (root `CLAUDE.md`, "A session
  starts from a current main").
- **Read** `docs/scenarios/CLAUDE.md` and the Ukrainian column of
  `docs/architecture/glossary.md`. State the mode, build or refresh, and the
  branch in one line before going on.

## Phase 2 — Inventory what there is to describe

The inventory comes from the code, because only the code is complete by
construction: a page or a write that no document mentions still exists.

Dispatch one `Explore` subagent ("very thorough"). It cannot write files, so it
returns the inventory as a table in its reply, and this skill saves that table
to `.gate/scenarios-inventory.md` for Phases 4 and 7 to read back narrowed. The
table holds:

- every page under `app/` that a visitor or a signed-in teacher reaches, and
  what it shows;
- every Server Action in `lib/actions/` that a page binds, with the page, the
  validation schema it parses, the user-facing error messages it can return,
  and the tests that cover it;
- every read the teacher drives from a page: views, switches, navigation.

**Refresh:** inventory only what `git diff --name-only <base>..origin/main`
touches under `app/`, `lib/actions/`, `lib/validation/`, `lib/domain/`, plus
every feature layer that became done since `base`. A scenario whose `trace`
names none of those paths is left as it is.

## Phase 3 — Read the sources

In this order, each for what `docs/scenarios/CLAUDE.md` says it is trusted
for:

1. `docs/specs/specification.md` — whole, once.
2. `docs/demo-scenario.md` — whole, once. Note its date: what it says is
   verified as of then, and anything done after it is not in it.
3. `docs/features/*/` — the layers marked done, oldest first. There may be
   none.
4. `docs/backlog/` — titles and statuses only
   (`grep -H -E '^(id|title|status):' docs/backlog/T-*.md`), opening a ticket
   body only to tell whether a behaviour was meant.
5. The code the inventory points at — validation schemas and tests first,
   because they state the edge cases the application actually handles.

Large outputs go to files and are read back narrowed (root `CLAUDE.md`, "Two
habits that keep a call small").

## Phase 4 — Draft

1. **Intents.** Turn the inventory into intents, by the scope rule of
   `docs/scenarios/CLAUDE.md`, and group them into areas. Every row of the
   inventory must land in some intent's `trace`.
2. **Steps.** Where the demo scenario walks an intent, take its steps — it was
   checked in a browser — and correct them against the code for anything
   changed since its date. Otherwise take them from the page and its form.
3. **Edge cases.** Go through all five categories for every scenario. A case
   goes in only with the behaviour the code shows: the refusal and its message
   from the validation, the rule from the domain, the case a test pins. Name
   the categories that do not apply.
4. **Not built.** What the specification or a done feature promises and the
   inventory does not contain goes to «Задумано, але не збудовано» with its
   section — never into a scenario.
5. **Disagreements.** A document says one thing, the code does another: the
   scenario states what the code does; if a teacher would notice, the pair goes
   to «Розбіжності».
6. **Questions.** Collect, do not resolve alone: code doing something that no
   document explains and that could be a defect as easily as a choice; two
   documents disagreeing where the code is ambiguous; a screen that may or may
   not be meant for a teacher.

## Phase 5 — Ask

This is not an interview. Nothing the documents or the code answer is asked.

Ask the collected questions with `AskUserQuestion`, up to four per call, in
Ukrainian. Each question gives the scenario, what each source says and what
the code does, and why the answer changes the catalogue. Each option says what
the catalogue will record if it is chosen. "Leave it open" is always an option.

- An answer that the behaviour is a defect does not change the scenario — it
  still records what the application does — but the defect goes to
  «Розбіжності» with the user's words. Filing a ticket for it is the user's
  call, not this skill's.
- An unanswered or deferred question goes to «Відкриті питання».
- An answer is never invented. If `AskUserQuestion` is denied, every question
  goes to «Відкриті питання» and the report says so.

## Phase 6 — Verify in a browser, when it can run

If the application can be started here — Postgres up, `.env` set, the steps of
`docs/demo-scenario.md` §1 succeed — walk through the scenarios in Chromium
with the demo data, starting with the ones marked `у коді`, and mark each one
walked `у браузері <date>`. Correct any step the walk contradicts.

If it cannot be started, say why once; the labels stay `у коді`. A scenario is
never marked as walked when it was not. On a refresh, walk only the scenarios
the refresh changed.

## Phase 7 — Write, check, hand over

**Write** the area files and the README in the format of
`docs/scenarios/CLAUDE.md`. On a refresh, edit in place: never renumber, and
mark a removed behaviour **Вилучено** rather than deleting it. Set `base` to the
`origin/main` commit the run read, `updated`, and `next_id`.

**Check**, and fix before going on:

1. **Completeness** — every page and every write in the inventory appears in at
   least one `trace` (grep the paths from the inventory against the area
   files).
2. **Language** — outside the `trace` comments and the frontmatter, no
   backticks, no paths, no ticket ids, no English identifiers. Grep for
   `` ` ``, `lib/`, `app/`, `T-[0-9]`, and words in Latin letters, and read
   every hit.
3. **Ids** — unique, and every new one below `next_id`.
4. **Labels** — every scenario has **Перевірено**, and every `лише в
   документах` has its entry in «Відкриті питання».
5. **Gate** — `npm run gate`.

**Commit** on the branch, in the commit convention of the root `CLAUDE.md`.
Pushing, `/teachers-review` and the pull request follow the direct-change rules
there; this skill does not merge.

**Report** in the user's language: how many scenarios in how many areas, how
many under each **Перевірено** label, what went to «Розбіжності» and
«Відкриті питання», and what could not be verified and why.

## What this skill does not do

- It does not change code, and it does not file tickets for the defects it
  finds. It records them; the user decides.
- It does not describe intended behaviour as current, however reasonable.
- It does not restate mechanisms. How a behaviour is built belongs to
  `docs/architecture/`; the scenario says what the teacher sees.
