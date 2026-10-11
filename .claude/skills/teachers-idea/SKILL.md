---
name: teachers-idea
description: Turn a raw feature idea into an agreed docs/features/<slug>/idea.md through an interview with the user — the problem, what changes for the teacher and what does not, what the teacher will get, the boundaries, the simpler paths rejected, the risks a clean-context reviewer finds, and the questions left open. It reads what the scenario catalogue, the ADRs, the architecture's open questions and the backlog already answer, asks only the rest, and writes nothing until the user confirms the final text. Use when the user invokes /teachers-idea (with a slug and, optionally, the raw idea), asks to "capture an idea", "interview a feature", "write up the idea for X", «нова фіча», «інтерв'ю ідеї», or wants to change what an agreed idea promises. It does not write the feature's scenarios, its design, its ADRs or its tickets.
---

# Idea

**The format and rules of `idea.md` are `docs/features/CLAUDE.md`; why
features live there is `ADR-030`.** This file is the method only: what to read,
how to interview, when to stop, and how to check the text. A rule about the
document that appears here and not there is a bug in this file.

An idea is agreed **in the interview**, by the user, not reconstructed later by
a reviewer. The one failure this skill exists to prevent is an `idea.md` that
says more than the user said: an answer filled in because it was sensible, a
section completed from the skill's own view, a risk softened because the
interview went well. Every sentence below the raw idea is either the user's
answer, a fact cited from a document, or an open question.

The specification is not read (`docs/features/CLAUDE.md`, «Sections»).

## Phase 1 — Resolve the run

- **Arguments.** `/teachers-idea <slug> [raw idea]`. No slug: Phase 2 proposes
  two or three, right after the raw idea, and the rest of this phase runs once
  one is chosen.
- **Repository state.** If the session-start fetch did not run (root
  `CLAUDE.md`, "A session starts from a current main"), say so; the report
  then says the repository state was not verified.

Once the slug is known, in this order:

1. **An interrupted run.** Look for `.gate/idea-<slug>.md`. If it is there, a
   previous run stopped: say in one line how far it got — the last phase
   finished, the batches answered — and ask whether to continue from it or
   start over. Continuing keeps its raw idea and its answers and resumes after
   the last phase finished, on the branch it names if it cut one; a raw idea
   given in this run's arguments is put to the user as the first answer, not
   as a second raw idea. If `origin/main` has moved since the commit read,
   Phase 3 runs again first and the user is told what changed. Starting over
   deletes the file.
2. **New or revision.** The existing text is `docs/features/<slug>/idea.md` on
   an unmerged branch `docs/idea-<slug>` (local or on `origin`) if there is
   one — it is the newer, written but not merged yet — and otherwise on
   `origin/main`. No existing text: a new idea. Otherwise a revision, whatever
   its status — whether to revise is the user's call, not the skill's. §1
   stays, and the interview covers only the change the user brings
   (`docs/features/CLAUDE.md`, «Changes after agreement»). The draft starts as
   the existing text, every sentence sourced as that file at its commit.
3. **Tickets.** On a revision, the tickets on `origin/main` whose `refs:` name
   `docs/features/<slug>/`
   (`git grep -l 'docs/features/<slug>/' origin/main -- 'docs/backlog/T-*.md'`)
   are listed to the user before the interview: they were written against the
   promises the revision may change. A `done` idea is said to be so in that
   line — what it promised is already in the catalogue.

State in one line: the slug, new or revision, where the existing text was
read from, and the commit read.

- **Branch.** An idea is a direct change (root `CLAUDE.md`, "A ticket run, or a
  direct change"). The work goes on `docs/idea-<slug>`: the existing branch if
  step 2 read from it, otherwise one cut from `origin/main` — but only in
  Phase 8, when there is something to write. Until then everything is read
  from `origin/main` or from that branch (`git show <ref>:<path>`,
  `git grep … <ref>`; root `CLAUDE.md`, "A session starts from a current
  main"), never from the working tree.
- **Working state.** The interview is long, and the session may be compacted
  in the middle of it. Keep it in `.gate/idea-<slug>.md` (git-ignored), under
  these headings:
  - the last phase finished; the branch, once there is one;
  - the raw idea, verbatim — on a revision, the change requested instead;
  - the slug, new or revision, where the existing text came from, and the
    commit Phase 3 last read;
  - whether the catalogue was behind `main`; on a revision, the tickets listed;
  - the catalogue map (Phase 3);
  - the answers, each with its batch number and the question it answered;
  - the simpler paths and the user's reasons;
  - the risks: the ones dropped before the user saw them, with why; the ones
    a boundary answers; what the user did with each of the rest;
  - the terms; the `Q-NNN` closed;
  - a part split off by the budget, if any;
  - the draft: each section written as soon as its answers are in, each
    sentence followed by its source — the batch and question, the document
    and line, the existing file, or the risk.

  Update it after every batch — that file, not the conversation, is what
  Phase 6 reads the draft from, what Phase 7 assembles from and what the
  report counts. Nothing under `docs/` is written before Phase 8.
- **Leaving.** The user may stop at any point; the working state is kept for a
  later run unless they ask for it to be deleted. Leaving by the «not needed»
  exit of Phase 3 deletes it.

## Phase 2 — The raw idea

If the arguments carry it, that text is the raw idea. If not, ask for it in
plain chat — «Опиши ідею своїми словами, як є» — and wait. It is kept
verbatim: no correction, no translation, no merging with later answers.
Nothing is asked before it except the interrupted-run question, when the slug
came with the arguments. On a revision the same text is the change requested.

If the arguments gave no slug, propose two or three now, from the raw idea and
by the slug rule of `docs/features/CLAUDE.md`, in one question; then run the
rest of Phase 1. The working state is created after the interrupted-run check,
with the raw idea written first.

## Phase 3 — Read what is already answered

Independent reads go in one message (root `CLAUDE.md`, "Two habits that keep a
call small"); large outputs go to files and are read back narrowed.

1. `docs/features/CLAUDE.md` — whole.
2. `docs/architecture/glossary.md` — the Ukrainian column and §9.
3. `docs/scenarios/README.md`. If there is none, the catalogue is not built:
   say so, propose `/teachers-scenarios`, and stop. Otherwise, first, whether
   it is current. Two things make it behind `main`: commits since its `base`
   over the paths `/teachers-scenarios` inventories on a refresh (its Phase 2,
   «Refresh»), read with `git log --oneline <base>..origin/main -- <paths>`;
   and a feature that became `done` since `base`, read with
   `git log --oneline <base>..origin/main -- 'docs/features/*/idea.md'` and the
   `status` of each file it names. If either is there, the catalogue may not
   show what a teacher meets now: list it to the user and propose
   `/teachers-scenarios` first. Going on anyway is the user's call, recorded
   in the working state.
   Then the area files the raw idea touches. Map the idea onto the catalogue:
   which scenarios it changes, which it leaves alone, and which intents it adds
   that no scenario has. This map is the spine of the interview and is kept in
   the working state; it is the skill's reading, not a source — nothing goes
   into the draft from it without an answer.
4. The ADRs — `id`, `title` and `status` only
   (`git grep -h -E '^(id|title|status):' origin/main -- 'docs/architecture/decisions/ADR-*.md'`).
   One that is accepted and whose title bears on the idea is opened: an idea
   that goes against a decision already taken is put to the user as that, in
   the «fit» category, not found later in the design.
5. `docs/architecture/architect-overview.md` §10 — the open questions; an idea
   that depends on one inherits it.
6. `docs/backlog/` — titles and statuses
   (`git grep -h -E '^(id|title|status):' origin/main -- 'docs/backlog/[TQ]-*.md'`),
   and the other `docs/features/*/idea.md` on `origin/main`: work in flight.
   An overlap is put to the user in the «fit» category.

**Before the interview, say if it is not needed.** If the map shows the
catalogue already does what the idea wants — a scenario ends in what the idea
asks for — or the idea adds no intent and changes one scenario in a way that
fits in one ticket, say so with the scenario. The user chooses: go on, stop
here, or write a ticket instead (a direct change under `docs/backlog/CLAUDE.md`,
not this skill's work).

## Phase 4 — Interview

`AskUserQuestion`, two or three questions per call, in Ukrainian, over five
categories, picked by the shape of the idea rather than in a fixed order:

- **the problem** — what the teacher cannot do now, or does at a cost, and how
  often; in terms of the scenarios from the Phase 3 map;
- **the solution** — why this way, what the teacher does instead today;
- **what the teacher will get** — the action and what the teacher sees after
  it, for each changed or new intent. Where the idea gives a new way to do what
  a catalogue scenario already does, ask whether it must end in what that
  scenario ends in — scenario by scenario, or for a group of them at once
  where the answer is plainly the same. Whether the feature reaches the
  teacher in parts, and in what order, is asked here too;
- **constraints** — what must not change (it becomes «Що не змінюється»: each
  item an answer, never taken from the map alone), dependencies on open
  questions or on work in flight;
- **fit** — how it sits with what the application does now, with work in
  flight, and with the decisions the ADRs record.

**How a question is written.** The question: which section it fills, what is
already collected in one line, and what breaks if the answer is wrong. Each
option: what the idea will say if it is chosen, and the trade-off, in two to
four sentences — not a one-word label. Where a document already answers, the
question cites it («S-014 закінчується тим, що …; так і має лишитися?»)
instead of asking from scratch; where it fully answers, there is no question.

**Options, or a plain question.** Options when the space of answers is known:
alternatives the documents or the idea itself give, or a plain scale («щодня /
щотижня / раз на семестр»). A question whose answer is a fact only the user
holds — a concrete episode, what the teacher does today, why it matters now —
is asked in plain chat, without options: options there would be the skill's
guesses, and the nearest guess would be taken for the answer. Such questions
go together in one message, not one per turn. No option is ever marked as
recommended, and a question about a fact offers «Не знаю», which sends the
point it was to settle to §8.

**A vague or contradicting answer** — a free-text answer that does not settle
the point, or one that contradicts an earlier answer — gets one follow-up,
citing the earlier answer where there is one. Still unsettled after it, the
point goes to §8.

**A point sent to §8** is recorded with what each answer would change, taken
from what its question said breaks; where that does not cover it, the user is
asked — it is not written from the skill's view.

**When to stop.** When §2–§5 can each be written from the user's answers and
the documents, with no sentence the skill would have to supply itself. What is
still unsettled then goes to §8: the interview is not stretched until every
question has an answer.

**Never invented.** An option the user did not choose is not an answer. If
`AskUserQuestion` is denied, stop and say so — the questions with options have
no other way to be asked — and leave the working state for the next run.

## Phase 5 — Simpler paths

Propose the paths simpler than the agreed idea that actually exist, two at
most: a smaller scope that gives the teacher most of it, an existing form that
already does part of it, a later step that could be dropped. A comparable tool
the user names, or that is widely known to solve the same problem, may serve
as the reference; nothing is invented about how it works. **Finding none is a
normal result**, and is said so: §6 then holds only the paths the user raised,
or «Немає.». Ask in one batch. A path the user takes changes the idea, and the
affected answers are re-asked; a path the user rejects goes to §6 with the
user's reason — asked for in plain chat, not taken from an option's text.

## Phase 6 — Risks, from a clean context

Dispatch one `general-purpose` subagent. Its prompt, in English, holds only:
the raw idea; the draft §2–§5 from the working state — on a revision the whole
of them, the change marked; the catalogue map; the paths `docs/scenarios/` and
`docs/architecture/glossary.md`, to be read with `git show origin/main:<path>`;
the risks already in §7, the questions already in §8 and the risks already
dropped, so that it does not raise them again unless the change makes them
new; and the lenses below. **Not** the interview, not the rejected paths, not
the skill's own view of the idea — the reviewer must not inherit the optimism
of the conversation. The prompt forbids it to read `.gate/`: the working state
holds the interview. If the subagent cannot be dispatched, stop as for a
denied `AskUserQuestion`.

It returns up to ten ways the idea fails the teacher, each written in
Ukrainian by the language rule of `docs/features/CLAUDE.md`, so that no
translation stands between its wording and §7: what triggers it, what the
teacher meets, how one would notice. A risk that rests on a claim about what
the application does now cites the catalogue scenario or document line
(`file:line`); one about behaviour the feature brings and nothing has yet is
marked «нова поведінка». **No risk found is a normal result**, and the prompt
says so: a padded list costs the user more than an empty one.

The lenses:

- the edge categories of `docs/scenarios/CLAUDE.md` («Особливі випадки»);
- **the problem left standing** — the teacher gets everything §4 promises, and
  what §2 describes is still true;
- **a broken promise** — something «Що не змінюється» or a neighbouring
  catalogue scenario keeps, which the idea changes after all;
- **a silent wrong result** — the application does something other than the
  teacher meant, and nothing on the screen shows it;
- **no way back** — an action the teacher cannot undo, or can undo only by
  doing the work again;
- **what is already there** — the years, timetables and events the teacher
  entered before the feature arrived;
- **more work** — the new way takes more steps or more attention than the one
  it replaces.

**Before the user sees them,** open the line each cited risk names. One whose
line does not say what the risk claims about the application is dropped,
recorded in the working state with why, and counted in the report. A risk
marked «нова поведінка» is not dropped for having no line. Risks a §5 boundary
already answers are put to the user together, in one question, each with the
boundary that answers it; the user may agree or take any of them back into
the list below.

Put the rest to the user, up to four per call. For each: keep it as a risk
(§7), answer it with a boundary (§5) or a change to the idea (back to Phase 4
for that point), make it an open question (§8), or drop it with a reason. A
risk is never softened in the wording; one the user drops goes, with the
user's reason, into the comment at the end of §7 (`docs/features/CLAUDE.md`). If
the reason the user gives contradicts a document or an earlier answer, say so
once, citing both; the user decides, and the point is not raised again. A risk
the user named themselves during the interview goes to §7 as they stated it.

**A change gets one more look.** Each change that alters §3–§5 — made here in
answer to a risk, or asked for in Phase 7 — gets its own subagent pass, built
by the same rules and limited to that change. A change made in answer to a
risk from such a pass gets no pass of its own: it goes to §8 as an open
question about itself, unless the user confirms it as it stands.

## Phase 7 — Assemble, check, confirm

**Terms.** Collect every word the idea introduces for the teacher — a name for
something new the feature brings — that the glossary does not have. Apply the
audience test of `docs/features/CLAUDE.md`. A word that fails it is replaced
with plain words. A word that passes is put to the user — the word and one
sentence of meaning — to accept, reword, or replace; accepted ones are added
to the glossary in Phase 8.

**Assemble** `idea.md` from the working state's draft, in the format of
`docs/features/CLAUDE.md`.

**Check** the assembled text before showing it, and fix it:

1. **Sections** — `docs/features/CLAUDE.md`, «Sections» and «Skeleton».
2. **Raw idea** — §1 equals, character for character, the Phase 2 text on a
   new idea, and the §1 of the existing text on a revision.
3. **Provenance** — every sentence of §2–§8 has its source in the working
   state's draft — an answer, a cited document, the existing file on a
   revision, a subagent risk the user kept, or a risk the user named — and
   the source says what the sentence says, no more. The catalogue map is not
   a source. A change the user asks for at confirmation is its own source. A
   sentence with none, or saying more than its source, is cut back, removed,
   or becomes an open question.
4. **Scenarios** — every `S-NNN` cited exists in `docs/scenarios/` on
   `origin/main`, and every item of «Що змінюється» names a scenario or says
   it is new.
5. **Language** — the rule and its exceptions are `docs/features/CLAUDE.md`,
   «Language». Grep the text outside those exceptions for backticks, paths,
   ids and words in Latin letters, and read every hit; every product term is
   in the glossary or in the batch above.
6. **Budget** — the body within the word budget of `docs/features/CLAUDE.md`.
   Over it: tighten §2 and the prose of §3 first. «Що не змінюється», §4, a
   risk, a boundary and a rejected path are never cut to fit — say instead
   that the idea may be two features, and let the user choose which part
   stays under this slug and name a slug for the other. The run goes on for
   the part that stays. The other gets its own working state under its slug —
   the whole raw idea and its origin as «Word budget» of
   `docs/features/CLAUDE.md` sets them, and the answers and risks that belong
   to it — where a later run finds it as an interrupted one.

**Confirm.** Show the full text in chat and ask one question: confirm it as
written, or say what to change. A change goes back through the check, and one
that alters §3–§5 also gets its look from Phase 6. Loop until the user
confirms. This is the last question the run asks, except the terms question a
change at confirmation may bring.

## Phase 8 — Write and hand over

Check out the branch (Phase 1, «Branch») — cutting it from `origin/main` if it
does not exist — and record it in the working state. Then write, asking
nothing:

- `docs/features/<slug>/idea.md`, its frontmatter as `docs/features/CLAUDE.md`
  sets it for a new idea or a revision («Frontmatter», «Changes after
  agreement»), `base` the commit Phase 3 last read;
- the accepted terms into `docs/architecture/glossary.md` §9;
- on a revision, every `Q-NNN` whose question this run answered — the id in
  the HTML comment after it in §8 — closed by the rules of
  `docs/backlog/CLAUDE.md`, `README.md` with it, in the same commit.

No `Q-NNN` is filed: no ticket exists yet to wait on one
(`docs/features/CLAUDE.md`, «Open questions»).

Run `npm run gate`. A failure in a file this run wrote is fixed only if the fix
changes no meaning of the confirmed text, and the gate is run again; any other
failure is reported, and the run stops before the commit — the working state
says Phase 7 was the last finished, so the next run resumes here on the same
branch. Commit in the convention of the root `CLAUDE.md`, and stop there: the
user confirmed a text, not its publication.

**Report** in the user's language, counted from the working state: the slug
and the path; how many scenarios the idea changes and how many intents it
adds; how many simpler paths were rejected, or that none was found; how many
risks were kept, moved or dropped, how many a boundary answered, and how many
were dropped before the user saw them as a wrong reading of the application;
the open questions and any `Q-NNN` closed; the terms added; whether the
catalogue was behind `main`, and whether the repository state was verified; a
part split off by the budget, with its slug; on a revision, the tickets listed
in Phase 1. Then the steps the direct-change rules of the root `CLAUDE.md` still
owe, for the user to take: push, `/teachers-review`, the pull request. The next
step after them is the feature's scenarios over the catalogue.

Delete `.gate/idea-<slug>.md` after the report.

## What this skill does not do

- It does not write `scenarios.md`, a design, an ADR or a ticket.
- It does not read or update `docs/specs/specification.md`: that is the
  starting idea (`ADR-030`).
- It does not decide for the user. When an answer is missing, the idea says
  so in §8.
