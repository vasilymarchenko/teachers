---
name: review
description: Review a pull request, a branch, or the uncommitted working tree against this repository's own documents — the acceptance criteria of the ticket it implements, the architecture, and the conventions. Use when the user invokes /review (optionally with a PR number, a PR URL or a branch name), asks to "review PR NNN", "review my changes", "review this branch before I push", or when /ticket phase 7 reviews its own PR.
---

# Review

**The standard is the repository's documents, read at review time — not a
checklist kept in here.** This file holds the method: how to find what to
review, what counts as a finding, and what to do with one. It deliberately
contains no architectural rule, because a rule copied here is a rule that
disagrees with the document it came from the first time that document changes.

A decision the project makes must not require an edit to this skill. Only a
change in the *kind* of thing being reviewed — another framework, another
database, another language — should.

## Phase 1 — Resolve the target

| Invocation | Target |
|---|---|
| `/review 12`, `/review <url>` | that pull request |
| `/review <branch>` | `origin/main...<branch>` |
| `/review` with a dirty tree | the uncommitted diff |
| `/review` with a clean tree on a feature branch | `origin/main...HEAD` |

```sh
gh pr checkout <n> && git diff origin/main...HEAD          # a PR
git checkout <branch> && git diff origin/main...<branch>   # a branch
git diff HEAD                                              # the working tree
```

**Check the target out.** `gh pr diff` fetches a patch and changes nothing on
disk, so a gate run after it tests whatever you were already sitting on — a
clean `main` type-checks perfectly while the PR under review does not. Either
check the target out, or say in the report that the gate did not run against it.
Note where you started, and return there when the review is done.

Then find the ticket, because half the review is unusable without one:

- a `T-NNN` in the branch name (`claude/ticket-t-017-...`), the PR title, or the
  PR body;
- failing that, a `docs/backlog/T-NNN-*.md` in the diff itself.

If none resolves, say so in one line — *"no ticket id found; reviewing against
the documents only"* — and carry on. Do not guess a ticket from a resemblance; a
review against the wrong acceptance criteria is worse than a review against none.

State the target, the ticket and the diff size in one line before moving on.

## Phase 2 — Read the standard

Read the root `CLAUDE.md` first. It maps this repository's documentation by
type — which document holds product decisions, which holds architecture, which
holds mechanics, which holds conventions — and that map, not this file, is how
you find what applies to the diff in front of you. Then read what the map points
at for the code that changed, in full:

- the ticket, and every path in its `refs:` (`path §N` means section N);
- the architecture document for the layers the diff touches, plus the glossary
  for every domain term it uses;
- the decision records that cover the area, and the conventions file for any
  directory the diff writes into;
- `docs/tech-stack.md`, then apply what you know about that stack — its
  boundaries, its trust edges, its query and rendering pitfalls. This is the one
  place your own knowledge is the standard rather than a document.

Every normative statement in those documents is a check, whether or not anyone
anticipated it. This is the expensive step and it is the point: it is what makes
a review current with a project that is still moving.

## Phase 3 — The mechanical gate

```sh
npm run lint; npm run typecheck; npm test
```

Separated deliberately: `&&` stops at the first failure, and a review that
reports a lint error while three tests are also red costs the author three
round-trips instead of one.

Add `npm run test:integration` when the diff touches `lib/db` — it needs a
migrated Postgres (`docker compose up -d`, then `npm run db:migrate`). If it
cannot run here, say so; never imply it passed.

Nothing a rule can decide should cost a reviewer's attention. A failure here is
a finding and does not stop the review — a broken build usually has more wrong
with it than the error says.

## Phase 4 — Two passes, in parallel

Send both in one message so they run at once.

1. **`review-contract`** (the subagent) — the diff against the ticket and the
   documents. Give it the diff or the command that produces it, the ticket id,
   and the ticket path. This is the pass a general-purpose reviewer cannot do,
   because it needs the ticket.
2. **`/code-review <target> high`** — generic correctness, reuse,
   simplification, efficiency. **Pass the same target phase 1 resolved.** With
   only an effort level it reviews the current diff, so on a PR target it reads
   an empty working tree, finds nothing, and the whole generic half of the
   review disappears while phase 5 still reports "both passes ran". Do not
   reimplement it and do not narrow it; it is an independent reading.

A newly added agent takes a moment to register, so `review-contract` can be
missing from the agent list in the session that created it. If it is, say so and
run the same pass as a general-purpose agent told to read
`.claude/agents/review-contract.md` and follow it — point at the file, never
paraphrase it into the prompt.

Then judge the diff against what you read in phase 2 yourself. That is the
architecture pass, and it is yours: the contract agent owns the ticket and the
documents' consistency with each other, `/code-review` owns generic correctness,
and neither knows whether this diff obeys the invariants the architecture states.

## Phase 5 — Merge, drop, rank, report

**A finding carries three things, or it is dropped:**

1. **`file:line`** — where.
2. **The rule** — quoted from the document it comes from: an acceptance
   criterion, a section of the architecture, a conventions file, a decision
   record, or a named fact about the stack. "Best practice" is not a rule. If
   the document does not actually say what you thought it said, the finding
   dies there — that is the check working.
3. **A failure scenario** — concrete inputs or state, then the wrong output,
   crash or exposure that follows. Not "this could be fragile".

A finding that cannot state a failure scenario is dropped, not softened into a
suggestion. Confident findings that turn out to be wrong are what teach a
reviewer's output to be skimmed, and a long list of maybes costs more attention
than it returns. An empty report is a valid and unremarkable result.

**A recorded decision is not a finding.** Where the project has written down an
accepted trade-off, a rejected alternative or the current default for an open
question, code that implements it is correct — do not re-propose the rejected
option, and do not file the cost as a defect. What *is* reportable is the diff
having reached the condition under which that decision said it should be
revisited, and code that contradicts a recorded default or implements it in a
second place. Read the decision before you report against it.

**Merge** the same defect found by two passes into one finding; two phrasings of
one problem read as two problems. **Rank** by severity: a security or
data-correctness defect, then a violated architectural invariant, then a broken
contract with the ticket or the documents, then reuse and simplification.
**Report** most severe first — through `ReportFindings` when the session has it,
in prose when it does not. The shape is what matters; a review must never be
blocked on a tool that may be absent.

With `--comment` on a PR target, post the findings as inline PR comments as
well; without it, report in the terminal only. Never post to a PR that was not
the review target.

## Phase 6 — Make the next review cheaper

A check that has now fired twice belongs in a lint rule or a convention test,
not in a reviewer's attention — this repository already keeps several, and the
gate in phase 3 runs them for free on every future review. Say so when you see
one, and name the rule or test that would replace it.

The same applies to the documents: if a rule you enforced was hard to find, or
you had to infer it from prose that also carries reasoning, that is a finding
against the document, and it is worth more than the code finding that exposed
it.

## Self-review mode

`/ticket` phase 7 calls this skill with the ticket already known. Same method,
same passes, two differences: the target is the ticket's own PR, and the caller
fixes the findings on the same branch rather than reporting them onward. Do not
post inline comments on your own PR unless the user asked for them.

## Definition of done

- The target and the ticket were stated, or the absence of a ticket was.
- The documents the diff touches were read at review time, not recalled.
- The mechanical gate ran, or its inability to run was reported.
- Both passes ran, plus your own reading of the diff against the architecture.
- Every reported finding quotes the rule it violates; everything else was
  dropped.
