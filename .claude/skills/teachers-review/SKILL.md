---
name: teachers-review
description: Review a pull request, a branch, or the uncommitted working tree against this repository's own documents — the acceptance criteria of the ticket it implements, the architecture, and the conventions. It reviews only, never edits, and touches a pull request afterwards solely under its two policy flags — --merge=no|ask|auto, which defaults to asking, and --comment/--no-comment, which defaults to posting. --effort low|medium|high|max, defaulting to high, sets how much reading one review is worth and is the level passed through to /code-review. Use when the user invokes /teachers-review (optionally with a PR number, a PR URL or a branch name), asks to "review PR NNN", "review my changes", "review this branch before I push", or when /teachers-ticket phase 7 reviews its own PR.
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

## Phase 1 — Resolve the invocation

**The target**, from the first positional argument:

| Invocation | Target |
|---|---|
| `/teachers-review 12`, `/teachers-review <url>` | that pull request |
| `/teachers-review <branch>` | `origin/main...<branch>` |
| `/teachers-review` with a dirty tree | the uncommitted diff |
| `/teachers-review` with a clean tree on a feature branch | `origin/main...HEAD` |

**The arguments.** Resolve all of them before doing anything, and state the ones
in force in the same line that states the target — a policy nobody saw applied
is a policy nobody agreed to.

| Argument | Values | Default in review mode | Default in self-review |
|---|---|---|---|
| `--merge` | `no` \| `ask` \| `auto` | `ask` | `no` |
| `--comment` / `--no-comment` | — | `--comment` | `--no-comment` |
| `--self-review` | `T-NNN` | off | set by `/teachers-ticket` phase 7 |
| `--effort` | `low` \| `medium` \| `high` \| `max` | `high` | set by `/teachers-ticket` phase 7, which is where the level is stated |

**What a level buys, and what it changes.** The four level names are
`/code-review`'s own, unchanged, so one word means one thing in both skills
rather than a second vocabulary beside the first. The flag is this skill's:
`/code-review` takes its level as a bare positional word, and this skill has
three other arguments a bare word could not be told apart from. What each level
buys is quoted from `/code-review`'s description, and that attribution is the
point: **low** and **medium** give fewer, high-confidence findings; **high** and
**max** give broader coverage and may include uncertain ones. If that changes
there, this line is wrong rather than quietly contradicted.

`/code-review` has a fifth level, `ultra`, and it is deliberately not offered
here: it is a user-triggered, billed cloud review that this skill cannot launch
on the user's behalf. Asked for it, say that and stop.

| `--effort` | Passed to `/code-review` | Phase 2 reads | Phase 6 |
|---|---|---|---|
| `low` | `low` | the conventions file of every directory the diff writes into | no |
| `medium` | `medium` | that, plus the ticket and every path in its `refs:`, and the decision records covering the changed paths | no |
| `high` | `high` | that, plus the architecture sections for the layers those paths belong to, the glossary for the terms they use, and `docs/tech-stack.md` | no |
| `max` | `max` | that, plus the code the diff does not change but depends on, read for the assumptions the change makes of it | yes |

A level is named in exactly two places in this file: the frontmatter
`description`, so the skill list shows what the argument does without the file
being opened, and **this block** — from the argument row above, through both
paragraphs, to the table itself. Everything inside it may name a level and
nothing outside it does, so changing a default is an edit to the block and to
the description, and no phase below can contradict the table because no phase
below names a level at all.

**An explicit flag always wins over a mode default**, in both directions: a
`/teachers-ticket` run told `--comment` posts comments, and a standalone review told
`--merge=no` does not offer to merge.

Both policies apply to a pull request target only. A branch or a working tree
has nothing to comment on and nothing to merge, so both are silently
inapplicable there — say so once rather than reporting them as refusals.

Both also need `gh` authenticated. If it is not, the review still runs in full
against the local checkout; report the findings in the terminal and say plainly
that commenting and merging were unavailable. Never report a policy as honoured
when the tool to honour it was missing.

```sh
gh pr checkout <n> && git diff origin/main...HEAD          # a PR
git checkout <branch> && git diff origin/main...<branch>   # a branch
git diff HEAD                                              # the working tree
```

**No fetch of this skill's own.** `origin/main` is the ref the session's
`SessionStart` hook fetched — the root `CLAUDE.md` states what that guarantees
and what it does not. A review run in a session whose hook could not run says so
in its report, and does not present a range taken against an unverified ref as
current.

**Check the target out.** `gh pr diff` fetches a patch and changes nothing on
disk, so a gate run after it tests whatever you were already sitting on — a
clean `main` type-checks perfectly while the PR under review does not. Note
where you started, and return there when the review is done.

This is no longer only phase 3's problem. Phase 2 derives every document it
reads from the range this checkout defines, so reviewing a pull request from a
`main` checkout yields an empty range, no documents, a generic pass scoped to
nothing, and an empty report indistinguishable from a clean change. **If the
target cannot be checked out**, take the paths from the pull request itself —
`gh pr diff <n> --name-only` — and say in the report that the tree was not the
target's, so no local verdict was produced against it. What you must never do is
carry on from the wrong tree silently.

Then find the ticket, because half the review is unusable without one.
`--self-review T-NNN` names it, and there is nothing to search for; otherwise
look for:

- a `T-NNN` in the branch name (`claude/ticket-t-017-...`), the PR title, or the
  PR body;
- failing that, a `docs/backlog/T-NNN-*.md` in the diff itself.

If none resolves, say so in one line — *"no ticket id found; reviewing against
the documents only"* — and carry on. Do not guess a ticket from a resemblance; a
review against the wrong acceptance criteria is worse than a review against none.

State the target, the ticket, the arguments in force and the diff size in one
line before moving on.

## Phase 2 — Read the standard

Read the root `CLAUDE.md` first. It maps this repository's documentation by
type — which document holds product decisions, which holds architecture, which
holds mechanics, which holds conventions — and that map, not this file, is how
you find what applies to the diff in front of you.

**Which documents, is derived from the diff — never from a list kept here.**
Start from the paths the change touches, over the range phase 1 resolved:

```sh
git diff --name-only origin/main...HEAD      # a pull request, or a branch
git diff --name-only HEAD                    # the working tree
```

Take that range, not the first line by habit: on a dirty working tree
`origin/main...HEAD` is empty, and a review that derives no paths reads no
document, scopes the generic pass to nothing, and reports an empty result that
looks exactly like a clean change.

Then follow the map outward from those paths: the conventions file of every
directory they sit in — a directory may carry its own, and it wins over the root
for that subtree — then the ticket and its `refs:` (`path §N` means section N),
the decision records covering that area, the architecture sections for the
layers those paths belong to, and the glossary for every domain term they use. A
document the changed paths do not reach is not read. That is what makes a review
cost what the change is worth rather than what the repository is worth, and it
is the only thing narrowed: each document that *is* reached is still read in
full, at review time, never recalled.

**How far outward that goes is the third column of the effort table in phase 1.**
Read to the row in force and stop; the caller chose that breadth, and reading
past it spends the budget the next round needs. Where the reading reaches
`docs/tech-stack.md`, apply what you know about that stack — its boundaries, its
trust edges, its query and rendering pitfalls. This is the one place your own
knowledge is the standard rather than a document.

Every normative statement in those documents is a check, whether or not anyone
anticipated it. This is the expensive step and it is the point: it is what makes
a review current with a project that is still moving.

## Phase 3 — The mechanical verdict

What a review needs from the checks is a verdict on **this head, with this
tree**. Producing one and establishing one are different things: on a pull
request, a better-equipped machine has usually produced it already.

| Target | Where the verdict comes from |
|---|---|
| a pull request | what `ci.yml` reported on the head under review — `ADR-007` makes it the authoritative gate, and it runs the checks this machine reports as `skipped` |
| a pull request whose CI verdict is not readable yet | `.gate/last-run.json`, if that run was against this head and tree |
| a branch, or the working tree | `npm run gate`, because nothing else has |

**The rows are in precedence order and the first that fits wins.** Self-review is
not a fourth target: it is a pull request, and it is the second row's usual case,
because the caller has just pushed and CI has not finished. Where CI's verdict on
that same head becomes readable it supersedes the ledger row — it ran the checks
the local run reports as `skipped`, so the two are not equal evidence even when
they agree.

**Read a local verdict as a whole run, never as a row.** `.gate/ledger.jsonl` is
append-only with one row per check per run, so a head that was gated, failed,
fixed and re-gated carries passing and failing rows for the same `commit`, and
"the row for that head" would let a reviewer find one passing `lint` row and
merge a branch whose `build` failed. `.gate/last-run.json` is the whole of the
last run — its `commit`, its `dirty`, and every check with its result — and
`npm run gate -- --report` is what reads it and refuses when it does not match
`HEAD`. Use those. Selecting rows out of the ledger by hand reimplements a
question the gate already answers, which is what `ADR-012` exists to stop; the
ledger is where the loop's counts come from, not where a verdict is.

**The local gate still runs wherever no verdict on this exact head exists, is
pending, or cannot be read** — `gh` unauthenticated, a run still in flight, no
ledger row for this commit. It is the fallback, and it is never wrong to reach
for; what would be wrong is reporting its absence as a pass.

**What the guarantee turns on is the head and the tree a verdict was produced
against, not which command produced it.** A verdict counts for what it ran
against and for nothing else. A verdict from a different head is a verdict on
different code. A verdict from a dirty tree is a verdict on that dirty tree —
which is evidence where the target *is* that working tree, and never for a
commit, because a tree nobody else has is not the tree anyone will merge. Either
mismatch voids it, whether it came from CI, from the ledger, or from a run on
this machine a minute ago. That is the bug `T-017`
found the hard way, stated as the thing that actually causes it rather than as a
rule about whose gate may be trusted. `.gate/ledger.jsonl` carries `commit` and
`dirty` on every row for exactly this comparison; check both before accepting
one, and re-run rather than accept a row that fails either.

**Where no verdict can be established at all, the report says so** — which
target, and what could not be read. Never that it passed.

```sh
npm run gate
```

One command, and the only one this skill runs to check a change. It resolves
what the branch adds to `origin/main` plus the uncommitted change, selects the
checks that change needs, runs **all** of them without short-circuiting, prints
one table and exits non-zero if any failed. A review that reports a lint error
while three tests are also red costs the author three round-trips instead of
one — and a chain of commands joined so that the first failure hides the rest is
precisely how that happens. The gate is what stops it.

Which checks exist, and which change pulls each one in, is
`scripts/gate/checks.ts`, held in step with `ci.yml` by
`scripts/gate/checks.ci.test.ts` (`ADR-012`). None of it belongs in this file:
a check list copied here is a list that disagrees with the workflow the first
time the workflow changes, which is the same reason this skill carries no
architectural rule.

A check this machine cannot run — no Docker daemon, no `DATABASE_URL` — comes
back `skipped` with the reason. **Report it as a skip, with the reason. Never
imply it passed.**

Where the verdict came from elsewhere, carry its skips too: a `skipped` row in a
ledger written on this machine is still a skip, and `ci.yml` is worth reading
precisely because most of them are not skips there.

Nothing a rule can decide should cost a reviewer's attention. A failure here is
a finding and does not stop the review — a broken build usually has more wrong
with it than the error says.

## Phase 4 — Two passes, in parallel

Send both in one message so they run at once.

1. **`teachers-review-contract`** (the subagent) — the diff against the ticket and the
   documents. Give it the diff or the command that produces it, the ticket id,
   and the ticket path. This is the pass a general-purpose reviewer cannot do,
   because it needs the ticket.
2. **`/code-review`** — generic correctness, reuse, simplification, efficiency.
   Invoke it with the target phase 1 resolved, the level the effort table gives
   for the `--effort` in force, **and** a scope restricted to the paths the diff
   touches.

   **The target**, because with only an effort level it reviews the current
   diff: on a pull request target it would read an empty working tree, find
   nothing, and the whole generic half of the review would disappear while the
   report still claimed "both passes ran".

   **The paths**, from the same `git diff --name-only` phase 2 ran, because
   without them the pass spends its budget on files the change never touched and
   returns findings the author cannot act on from this branch.

   Be honest about what that buys. In `/code-review`'s own grammar a path is a
   *target* — an alternative to a pull request number, not a filter laid over
   one — so passing both asks for something its interface does not promise, and
   the paths may simply be ignored. Pass the target first and the paths after
   it, and read *what the result says it reviewed*. An empty finding list is
   not the signal — a clean pull request gives one too, and re-running on that
   guess doubles the cost of the pass in exactly the case this scoping was
   meant to make cheap. The signal is the pass reporting that it found no
   changes, read an empty tree, or reviewed files outside the scope you gave
   it. Then re-run with the target alone, and say in the report that you did. **What actually enforces the scope is phase 5**,
   which drops a finding the change did not cause whatever produced it. The
   argument is the saving; the drop rule is the guarantee.

   Do not reimplement it, and do not narrow what it looks *for*. Narrowing
   *where* it looks is a different thing and is the point; within that scope it
   is still an independent reading.

A newly added agent takes a moment to register, so `teachers-review-contract` can be
missing from the agent list in the session that created it. If it is, say so and
run the same pass as a general-purpose agent told to read
`.claude/agents/teachers-review-contract.md` and follow it — point at the file, never
paraphrase it into the prompt.

Then judge the diff against what you read in phase 2 yourself. That is the
architecture pass, and it is yours: the contract agent owns the ticket and the
documents' consistency with each other, `/code-review` owns generic correctness,
and neither knows whether this diff obeys the invariants the architecture states.

## Phase 5 — Reconcile, drop, rank, report

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

**A finding the change did not cause is not a finding of this review.** The test
is causation, and a `file:line` outside the diff is how it is nearly always
read: that defect was inherited, the author cannot fix it from this branch
without widening their own pull request, and a loop that must dispose of it
spends a round on code nobody in this review touched. Drop it. This holds
however the finding arrived — the scope passed in phase 4 narrows where the
generic pass looks, and this rule is what makes the narrowing hold when it looks
anyway.

**A file the diff obliged to change and did not is inside the change, wherever
its line number falls.** Where a document says that one place mirrors another —
a backlog row against the frontmatter it mirrors, an index against the file it
lists, the glossary against a term the diff introduces — a change that edits one
side and not the other *caused* a defect whose `file:line` is on the side it left
alone. Report it as a finding like any other, quoting the rule that the two
places must agree. It is the contract pass's whole lens, and it is one line for
the author to fix on this branch.

One exception past that, worth a section and no more. A **security or
data-correctness** defect the change did not cause is still real, and losing it
to a scoping rule would be the rule doing harm. Name it under a final
`## Outside this change` heading, with the same three parts as any finding, and
say plainly that it is out of scope: nothing in the review's verdict or the
caller's loop turns on it. **Filing it is the reader's call, and the section is
how the reader gets the chance** — a standalone review leaves it with the user,
and a self-review carries it into the caller's final report, which is the last
thing a person reads before the branch merges. Do not route it through phase 6:
that phase does not run at most levels, and an exception carved out to stop a
rule doing harm cannot depend on a phase that may be skipped. Nothing else goes
in that section; it is not a home for the maybes the bar above dropped.

**A recorded decision is not a finding.** Where the project has written down an
accepted trade-off, a rejected alternative or the current default for an open
question, code that implements it is correct — do not re-propose the rejected
option, and do not file the cost as a defect. What *is* reportable is the diff
having reached the condition under which that decision said it should be
revisited, and code that contradicts a recorded default or implements it in a
second place. Read the decision before you report against it.

**Reconcile** the two passes: one defect found by both is one finding, not two —
two phrasings of one problem read as two problems. **Rank** by severity: a security or
data-correctness defect, then a violated architectural invariant, then a broken
contract with the ticket or the documents, then reuse and simplification.
**Report** most severe first — through `ReportFindings` when the session has it,
in prose when it does not. The shape is what matters; a review must never be
blocked on a tool that may be absent. `## Outside this change` has no field in
that tool and is never squeezed into one: print it as prose beside the tool's
output, which is also what keeps it visibly separate from the findings the
caller must dispose of.

**In self-review mode, report a finding in the shape the caller records it in.**
`/teachers-ticket` phase 7 writes each one to `.gate/findings.json`, which wants
an id, the `file:line`, the rule quoted from the document it came from, a
one-sentence summary, and which pass found it. The bar above already produces
all but the last — name the pass too, so the caller does not have to guess it.

**Comments.** On a pull request target under `--comment` — the default in
review mode — post the findings as inline comments as well as reporting them
here. Only findings that survived the bar above are posted: the comment thread
is the author's working list, and padding it with maybes is worse there than in
a terminal, because it outlives the session. Under `--no-comment`, report here
only. Never post to a pull request that was not the review target.

## Phase 6 — Make the next review cheaper

**This phase runs only at the effort level the phase 1 table marks for it.**
Promoting a recurring check is worth a review's whole attention when the review
was asked for that breadth; drawn from a pass that read two directories it is a
proposal with no evidence under it. Below that level, skip the phase without
mentioning it.

A check that has now fired twice belongs in a lint rule or a convention test,
not in a reviewer's attention — this repository already keeps several, and
whatever produces phase 3's verdict runs them for free on every future change,
which is more reviews than this skill will ever be pointed at.

**This phase proposes; it never edits.** A new lint rule or convention test
changes the quality gate for every future change in the repository, including
code nobody in this review has looked at. That is a change of its own, and it
gets a ticket, a plan and a review like any other — writing it into the working
tree mid-review would also mix the reviewer's edits into the diff under review,
which is how a review stops being one.

So the output is a proposal, and it carries its homework:

- **the evidence** — the two occasions the check fired, not a guess that it
  might;
- **the rule or test, sketched** concretely enough to implement;
- **what it would flag in the repository today.** Run it. A rule that fails
  existing correct code is not ready, and the real finding is that it needs
  narrowing — a check phrased more widely than the rule it comes from is exactly
  how a reviewer starts producing confident nonsense.

In self-review mode the caller turns an accepted proposal into a backlog ticket,
as `/teachers-ticket` already requires of any real finding that is out of scope. On a
standalone review, name it in the report and leave the filing to the user.

The same applies to the documents: if a rule you enforced was hard to find, or
you had to infer it from prose that also carries reasoning, that is a finding
against the document, and it is worth more than the code finding that exposed
it.

## Phase 7 — Merge, only under the policy

Only a pull request target can be merged; a branch or a working tree cannot, and
the policy is ignored there. **Never merge a pull request that was not the
review target.**

Whatever the policy, merging requires all of:

- the review reported **no findings** — not "none serious", none;
- **`ci.yml` reported green on the head being merged**, and any required checks
  on the pull request are green. Merging is the one place phase 3's fallbacks do
  not carry: a local run's verdict lives in a gitignored file on one machine and
  skips the checks CI does not, so `ADR-007`'s authoritative gate is the only
  one a merge may rest on. A verdict that is merely established is enough to
  review on and never enough to merge on;
- `gh` reports the pull request mergeable, with no conflict and no block.

If any of those is unmet, say which and stop. `auto` is not an override: it
decides who is asked, never whether the conditions hold.

| `--merge` | Behaviour |
|---|---|
| `no` | Report and stop. The default in self-review mode. |
| `ask` | **Default.** If every condition above holds, say so and ask once — `AskUserQuestion`, with the merge method named. Otherwise report why it cannot merge, and do not ask. |
| `auto` | Merge when every condition holds, and say plainly that it was merged and by which method. Otherwise report and stop. |

Use the merge method this repository's history shows unless the user says
otherwise, and name the method in the ask rather than assuming it is understood:

```sh
gh pr merge <n> --merge      # this repository's existing history uses merge commits
```

A review that ends in a merge still prints its report first. The reader has to
be able to see what was reviewed, not just that it passed.

## Self-review mode

`/teachers-ticket` phase 7 calls this skill as `/teachers-review <pr>
--self-review T-NNN --effort <level>`. Same method, same passes; the
differences:

- **The ticket is given, not inferred.** Phase 1 skips the search and never
  reports "no ticket id found".
- **The findings are the output.** They go back to the caller, which fixes them
  on the same branch and commits them. This skill still edits nothing.
- **`--merge` defaults to `no`** — an author's own review is the last thing that
  should merge unattended — and **`--comment` to `--no-comment`**: inline
  comments on your own PR, which you are about to fix in the same session, are
  notes to yourself in a public place.
- **The effort level comes from the caller, which is where it is stated.**
  `/teachers-ticket` phase 7 names the level a round gets; this skill takes what
  it is given and states no self-review value of its own, so the one word is not
  written in two files that can disagree. Any round can be re-run by hand at
  another level.
- **The caller's loop is bounded.** It runs a fixed number of rounds, gate runs
  and pushes — the numbers are `scripts/gate/caps.ts`, and this skill states no
  number of its own. Two consequences for what is reported: a round that finds
  nothing undisposed is how the loop *ends*, so an empty report is a result and
  not a failure to look hard enough; and padding the list with maybes spends a
  round the author cannot get back.
- **Ask the user nothing.** Anything the ticket, the documents or the diff can
  settle, settle. The caller owns the conversation and will report once, at the
  end of its own phase 7; a question from here interrupts that for something
  the ticket already answers.

## Definition of done

- The target and the ticket were stated, or the absence of a ticket was.
- The documents the changed paths reach were read at review time, not recalled,
  and read as far out as the effort in force extends.
- A verdict was established against this head and this tree — produced here, or
  read from a record of the same — or the report said which target's verdict
  could not be read at all.
- Both passes ran, plus your own reading of the diff against the architecture.
- Every reported finding quotes the rule it violates and names a defect this
  change caused — including a document the change obliged to update and did not;
  everything else was dropped, except a security or data-correctness defect it
  did not cause, which was named under `## Outside this change` and owed no
  disposition.
- Nothing was edited: the review reports, and phase 6 proposes.
- The arguments in force were stated up front, and both policies were honoured —
  comments posted or not, a merge performed or not — or reported as unavailable
  with the reason.
