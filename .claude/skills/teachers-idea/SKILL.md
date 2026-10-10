---
name: teachers-idea
description: Turn a raw feature idea into an agreed docs/features/<slug>/idea.md through an interview with the user — the problem, what changes for the teacher and what does not, what the teacher will get, the boundaries, the simpler paths rejected, the risks a clean-context reviewer finds, and the questions left open. It reads what the specification, the scenario catalogue, the architecture and the backlog already answer, asks only the rest, and writes nothing until the user confirms the final text. Use when the user invokes /teachers-idea (with a slug and, optionally, the raw idea), asks to "capture an idea", "interview a feature", "write up the idea for X", «нова фіча», «інтерв'ю ідеї», or wants to change what an agreed idea promises. It does not write the feature's scenarios, its design, its ADRs or its tickets.
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

## Phase 1 — Resolve the run

- **Arguments.** `/teachers-idea <slug> [raw idea]`. No slug: propose two or
  three from the idea by the slug rule of `docs/features/CLAUDE.md` and let the
  user choose in Phase 4's first batch.
- **New or revision.** No `docs/features/<slug>/idea.md` on `origin/main`: a
  new idea. Otherwise a revision: §1 stays, and the interview covers only the
  change the user brings (`docs/features/CLAUDE.md`, «Changes after agreement»).
- **Branch.** An idea is a direct change (root `CLAUDE.md`, "A ticket run, or a
  direct change"). On `main`, or on a branch carrying unrelated work, the branch
  `docs/idea-<slug>` is cut from `origin/main` — but only in Phase 8, when there
  is something to write. Until then everything is read from `origin/main`
  (`git show origin/main:<path>`; root `CLAUDE.md`, "A session starts from a
  current main").
- **Working state.** The interview is long, and the session may be compacted
  in the middle of it. Keep the collected answers and the draft in
  `.gate/idea-<slug>.md` (git-ignored) and update it after every batch — that
  file, not the conversation, is what Phase 7 assembles from. Nothing under
  `docs/` is written before Phase 8.

State in one line: the slug, new or revision, and the commit read.

## Phase 2 — The raw idea

If the arguments carry it, that text is the raw idea. If not, ask for it in
plain chat — «Опиши ідею своїми словами, як є» — and wait. It is stored
verbatim in the working state: no correction, no translation, no merging with
later answers. Nothing else is asked before it.

## Phase 3 — Read what is already answered

1. `docs/features/CLAUDE.md` — whole.
2. `docs/architecture/glossary.md` — the Ukrainian column and §9.
3. `docs/scenarios/README.md`, then the area files the raw idea touches. Map
   the idea onto the catalogue: which scenarios it changes, which it leaves
   alone, and which intents it adds that no scenario has. This map is the
   spine of the interview; keep it in the working state.
4. `docs/specs/specification.md` — whole, once: it is the starting idea, and
   the new one is measured against what it already promised or excluded.
5. `docs/architecture/architect-overview.md` §10 — the open questions; an idea
   that depends on one inherits it.
6. `docs/backlog/` — titles and statuses
   (`grep -H -E '^(id|title|status):' docs/backlog/[TQ]-*.md`), and the other
   `docs/features/*/idea.md`: work in flight that the idea overlaps.

Large outputs go to files and are read back narrowed (root `CLAUDE.md`, "Two
habits that keep a call small").

## Phase 4 — Interview

`AskUserQuestion`, two or three questions per call, in Ukrainian, over five
categories, picked by the shape of the idea rather than in a fixed order:

- **the problem** — what the teacher cannot do now, or does at a cost, and how
  often; in terms of the scenarios from the Phase 3 map;
- **the solution** — why this way, what the teacher does instead today;
- **what the teacher will get** — the action and what the teacher sees after
  it, for each changed or new intent: this is where «a phrase must end where
  the form ends» is decided, scenario by scenario;
- **constraints** — what must not change (it becomes «Що не змінюється»),
  dependencies on open questions or on work in flight;
- **fit** — how it sits with what the application does now and with the
  specification's boundaries.

**How a question is written.** The question: which section it fills, what is
already collected in one line, and what breaks if the answer is wrong. Each
option: what the idea will say if it is chosen, and the trade-off, in two to
four sentences — not a one-word label. Where a document already answers, the
question cites it («Специфікація §5.2 каже …; це досі так?») instead of asking
from scratch; where it fully answers, there is no question.

**When to stop.** When §2–§5 can each be written from the user's answers and
the documents, with no sentence the skill would have to supply itself. What is
still unsettled then goes to §8; the interview does not go on until everything
is settled.

**Never invented.** An option the user did not choose is not an answer. If
`AskUserQuestion` is denied, stop and say so — this skill has no way to work
around it — and leave the working state for the next run.

## Phase 5 — Simpler paths

Propose one or two paths simpler than the agreed idea: a smaller scope that
gives the teacher most of it, an existing form that already does part of it, a
later step that could be dropped. A comparable tool the user names, or that is
widely known to solve the same problem, may serve as the reference; nothing is
invented about how it works. Ask in one batch. A path the user takes changes
the idea, and the affected answers are re-asked; a path the user rejects goes
to §6 with the user's reason.

## Phase 6 — Risks, from a clean context

Dispatch one `general-purpose` subagent. Its prompt, in English, holds only:
the raw idea; the draft §3–§5 as agreed; the paths `docs/scenarios/`,
`docs/specs/specification.md` and `docs/architecture/glossary.md`; and the edge
categories of `docs/scenarios/CLAUDE.md` («Особливі випадки») as the lenses.
**Not** the interview, not the rejected paths, not the skill's own view of the
idea — the reviewer must not inherit the optimism of the conversation. It
returns five to ten ways the idea fails the teacher: what triggers it, what
the teacher meets, how one would notice.

Put them to the user, up to four per call. For each: keep it as a risk (§7),
answer it with a boundary (§5) or a change to the idea (back to Phase 4 for
that point), make it an open question (§8), or drop it with a reason. A risk is
never softened in the wording; one the user drops is not recorded.

## Phase 7 — Assemble, check, confirm

**Terms.** Collect every word in the draft that names something for the
teacher and is not in the glossary's Ukrainian column. Apply the audience test
of `docs/features/CLAUDE.md`. A word that fails it is replaced with plain
words. A word that passes is put to the user — the word and one sentence of
meaning — to accept, reword, or replace; accepted ones are added to the
glossary in Phase 8.

**Assemble** `idea.md` from the working state, in the format of
`docs/features/CLAUDE.md`.

**Check** the assembled text before showing it, and fix it:

1. **Sections** — all eight, in order; an empty one says «Немає.».
2. **Raw idea** — §1 equals the Phase 2 text, character for character.
3. **Provenance** — every sentence of §2–§7 traces to an answer, a cited
   document, or a subagent risk the user kept. A sentence that traces to none
   is removed or becomes an open question.
4. **Scenarios** — every `S-NNN` cited exists in `docs/scenarios/`, and every
   item of «Що змінюється» names a scenario or says it is new.
5. **Language** — outside the frontmatter, §1 and comments: no backticks, no
   paths, no `T-`/`ADR-`/`Q-` ids, no words in Latin letters; every product
   term is in the glossary or in the batch above. Grep, then read every hit.
6. **Budget** — the body within the word budget of `docs/features/CLAUDE.md`.
   Over it: tighten §2 and §3 first; never drop a risk, a boundary or a
   rejected path to fit — say instead that the idea may be two features, and
   let the user decide.

**Confirm.** Show the full text in chat and ask one question: confirm it as
written, or say what to change. A change goes back through the check. Loop
until the user confirms. This is the last question the run asks.

## Phase 8 — Write and hand over

Cut the branch (Phase 1), then write, asking nothing:

- `docs/features/<slug>/idea.md`, frontmatter set: `status: agreed`,
  `agreed` and `updated` today on a new idea, only `updated` on a revision,
  `base` the commit Phase 1 read;
- the accepted terms into `docs/architecture/glossary.md` §9;
- a `Q-NNN` only for an open question the user said a ticket must wait on
  (`docs/features/CLAUDE.md`, «Open questions») — otherwise none.

Run `npm run gate`. Commit in the convention of the root `CLAUDE.md`. Pushing,
`/teachers-review` and the pull request follow the direct-change rules there;
this skill does not merge. Delete `.gate/idea-<slug>.md` once the commit holds
its content.

**Report** in the user's language: the slug and the path; how many scenarios
the idea changes and how many intents it adds; how many simpler paths were
rejected; how many risks were kept, moved or dropped; the open questions and
any `Q-NNN` filed; the terms added. The next step is the feature's scenarios
over the catalogue.

## What this skill does not do

- It does not write `scenarios.md`, a design, an ADR or a ticket.
- It does not update `docs/specs/specification.md`: that is the starting idea
  (`ADR-030`).
- It does not decide for the user. When an answer is missing, the idea says
  so in §8.
