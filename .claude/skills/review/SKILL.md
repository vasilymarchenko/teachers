---
name: review
description: Review a pull request, a branch, or the uncommitted working tree against this repository's standard — the acceptance criteria of the ticket it implements, the architecture decisions, and the stack. Use when the user invokes /review (optionally with a PR number, a PR URL or a branch name), asks to "review PR NNN", "review my changes", "review this branch before I push", or when /ticket phase 7 reviews its own PR.
---

# Review

The standard lives in `.claude/skills/review/references/rubric.md`. **Read it
first, every time.** This file is only the mechanics: what to review, in what
order, and how the passes fit together. Nothing here restates a check.

## Phase 1 — Resolve the target

| Invocation | Target |
|---|---|
| `/review 12`, `/review <url>` | that pull request |
| `/review <branch>` | `origin/main...<branch>` |
| `/review` with a dirty tree | the uncommitted diff |
| `/review` with a clean tree on a feature branch | `origin/main...HEAD` |

```sh
gh pr diff <n>                      # a PR
git fetch origin main && git diff origin/main...HEAD    # a branch
git diff HEAD                       # the working tree
```

Then find the ticket, because §A of the rubric is unusable without one:

- a `T-NNN` in the branch name (`claude/ticket-t-017-...`), the PR title, or the
  PR body;
- failing that, a `docs/backlog/T-NNN-*.md` in the diff itself.

If none resolves, say so in one line — *"no ticket id found; reviewing against
the documents and the stack only"* — and carry on. Do not guess a ticket from a
resemblance; a review against the wrong acceptance criteria is worse than a
review against none.

State the target, the ticket and the diff size in one line before moving on.

## Phase 2 — The mechanical gate

Run before any agent. Nothing an agent could deduce should cost agent attention,
and a failing suite changes what the findings mean.

```sh
npm run lint && npm run typecheck && npm test
```

Add `npm run test:integration` when the diff touches `lib/db` — it needs a
migrated Postgres (`docker compose up -d`, then `npm run db:migrate`). If it
cannot run here, say so; never imply it passed.

A failure here is reported as a finding and does not stop the review — the
agents still run, because a broken build usually has more wrong with it than the
error says.

## Phase 3 — Two passes, in parallel

Send both in one message so they run at once.

1. **`review-contract`** (the subagent) — the diff against the ticket and the
   documents. Give it the diff or the command that produces it, the ticket id,
   and the ticket path. This is the pass a general-purpose reviewer cannot do.
2. **`/code-review high`** — generic correctness, reuse, simplification,
   efficiency. Do not reimplement it and do not narrow it; it is an independent
   reading, and the overlap with the rubric is worth its cost.

A newly added agent takes a moment to register, so `review-contract` can be
missing from the agent list in the session that created it. If it is, say so and
run the same pass as a general-purpose agent told to read
`.claude/agents/review-contract.md` and follow it. Do not skip the pass, and do
not paraphrase the agent's instructions into the prompt instead of pointing at
them: a second copy of the standard is exactly what this skill exists to avoid.

Then take the checks the contract agent does not own — rubric §B (invariants)
and §C (stack) — and walk them yourself against the diff. In this first cut they
have no dedicated agent; carrying them here is deliberate, and they are the
checks most worth promoting into agents once real reviews show which ones fire.

## Phase 4 — Merge, drop, rank, report

- **Drop** anything rubric §D calls a decision rather than a finding, and
  anything that cannot carry the three parts §E requires. Dropping is the
  default; softening a weak finding into "consider…" is not an option.
- **Merge** the same defect found by two passes into one finding. Two phrasings
  of one problem read as two problems.
- **Rank** by severity, per §E.
- **Report** through `ReportFindings`, most severe first. An empty list is a
  valid and unremarkable result.

With `--comment` on a PR target, post the findings as inline PR comments as
well; without it, report in the terminal only. Never post to a PR that was not
the review target.

## Self-review mode

`/ticket` phase 7 calls this skill with the ticket already known. Same rubric,
same passes, two differences: the target is the ticket's own PR, and the caller
fixes the findings on the same branch rather than reporting them onward. Do not
post inline comments on your own PR unless the user asked for them.

## Definition of done

- The target and the ticket were stated, or the absence of a ticket was.
- The mechanical gate ran, or its inability to run was reported.
- Both passes ran, plus the §B and §C walk.
- Every reported finding carries `file:line`, a rule and a failure scenario;
  everything else was dropped.
