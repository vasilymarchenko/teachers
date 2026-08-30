---
id: T-017
type: ticket
title: Review skill that reads the documents
status: done
depends_on: []
refs:
  - .claude/skills/ticket/SKILL.md
  - CLAUDE.md
  - docs/backlog/CLAUDE.md
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
---

## Goal

Add a `/review` skill that reviews a pull request, a branch or the working tree,
and move `/ticket` phase 7 onto it, so that a bare PR review and a self-review
run the same way.

## Acceptance criteria

- [x] `.claude/skills/review/SKILL.md` holds the review **method** and no
      architectural rule: how to resolve a target, what to read, what counts as
      a finding, how to rank and report one, and how to make the next review
      cheaper. A decision the project takes must not require an edit to it —
      `ADR-001`.
- [x] The standard is the repository's documents, read at review time. The
      reviewer starts from the root `CLAUDE.md` documentation map and reads what
      it points at for the code that changed — architecture, glossary,
      conventions, decision records, `docs/tech-stack.md`.
- [x] A finding carries `file:line`, the rule **quoted from the document it
      comes from**, and a concrete failure scenario — inputs or state, then the
      wrong output. A finding that cannot state one is dropped rather than
      softened, and a rule the document turns out not to state is a finding
      against the reviewer, not the code.
- [x] A recorded decision is not a finding: code implementing an accepted
      trade-off, a rejected alternative or an open question's current default is
      correct. What is reportable is the condition under which the decision said
      it should be revisited having been reached.
- [x] A `review-contract` agent under `.claude/agents/` checks the diff against
      the ticket and the documents — every acceptance criterion against the code
      or test that satisfies it, item frontmatter against the index row that
      mirrors it, the glossary, the language rules, and a design or decision
      document against what was actually built.
- [x] `/review` reviews a PR (`/review 12`), a branch, or the working tree. It
      checks the target out, runs the mechanical gate — `lint`, `typecheck`,
      `test`, and `test:integration` when `lib/db` is touched — then the
      `review-contract` agent and the built-in `/code-review` with the same
      target, and reports the merged findings ranked. It never rewrites the
      generic correctness pass that `/code-review` already provides.
- [x] `/review` finds the ticket id from the branch name
      (`claude/ticket-t-NNN-*`) or the PR title, so a bare `/review 12` still
      gets the contract check, and says so plainly when it cannot find one.
- [x] `/ticket` phase 7 invokes `/review` in self-review mode instead of
      restating the checks, and phases 4 and 5 point at the documents rather
      than listing rules. No rule exists in two files.
- [x] `/review` never edits. Its "make the next review cheaper" phase proposes a
      lint rule or convention test and states what that rule would flag in the
      repository today; turning the proposal into work is a ticket, because a
      change to the quality gate affects code the review never looked at.
- [x] Merging a pull request is governed by `--merge=no|ask|auto`, defaulting to
      `ask` and to `no` in self-review mode. Any policy requires no findings, a
      gate that ran against the target and passed, and a pull request `gh`
      reports mergeable; `auto` decides who is asked, never whether those
      conditions hold.
- [x] `.claude/**` is English throughout, like the rest of the developer-facing
      tree (root `CLAUDE.md`).

## Notes

The first build of this ticket got the dependency direction wrong: it extracted
the checklist out of `/ticket` phase 7 into a shared `rubric.md` that both
skills loaded. The reasoning, the two failures that exposed it and the decision
that replaced it are in
`docs/architecture/decisions/ADR-001-review-reads-the-documents.md` — the first
ADR, written under the practice T-018 introduces. `rubric.md` and its convention
test were deleted before the branch was merged, along with the `vitest.config.mts`
and `tsconfig.json` entries that existed only to run that test.

Running the review on its own branch is what produced that reversal, and it
found fifteen findings before it. Two are worth carrying beyond the ADR. The
mechanical gate ran against whatever was checked out rather than against the
target — `gh pr diff` fetches a patch and touches nothing on disk, so reviewing
a PR from a clean `main` would have type-checked `main` and reported the build
clean. And `/code-review` was invoked without the target, so on the bare-PR
path this ticket exists to enable, its half of the review would have read an
empty tree and found nothing while the skill still claimed both passes ran.

The root `CLAUDE.md` lost its `## Skills` section rather than gaining a `/review`
row. Skill descriptions are surfaced to the model from each `SKILL.md`
frontmatter, so the section was a hand-maintained copy of derived data — and it
had already rotted, which is how the question came up.

`review-contract` pins `model: opus`. An agent that inherits the parent session's
model is sharper or duller depending on what the developer happened to be
running, and this agent's errors are false negatives — "every criterion is met"
— which are invisible. Worth settling empirically against commit `b418caf` of
this branch, which contains six known findings.

Deliberately not built: a second agent holding the architecture in its own
context while it judges the diff. The reading pass is carried by the orchestrator
for now. The trigger to split it out is the first ticket that touches
`lib/domain` or `lib/db`, where there is something for it to find — this ticket's
own diff had no such surface, so it proved nothing either way.

The skill can merge, and that is the only thing it can do to the repository —
under `--merge`, defaulting to `ask`. Everything else it produces is a report.
The phase that proposes promoting a repeated check into a lint rule was the
tempting place to break that: applying the rule mid-review would change the diff
under review and fail code nobody in the review had looked at. It proposes, with
the evidence and with what the rule would flag today — that last part is what
would have caught the `new Date()` rule this branch nearly shipped.
