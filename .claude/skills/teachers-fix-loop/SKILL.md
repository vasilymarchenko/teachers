---
name: teachers-fix-loop
description: The bounded review-fix loop over a pull request — review, triage, fix, gate, re-review — under caps counted from records the agent did not author, exiting at the first round that produces no finding inside the diff. It is the unit two entry points call: /teachers-ticket phase 7 calls it with a ticket bound, and a pull request with no ticket is the other caller. Takes the run state file, the pull request number, an optional ticket path and --effort; returns the exit reason and the rounds it recorded. Use when /teachers-ticket phase 7 runs, or when a caller asks for the fix-and-merge loop over a pull request by name — not as a way to review a change, which is /teachers-review.
---

# The bounded fix loop

```
review → triage → fix → gate → re-review
```

This file is the **one** place the loop is written down. `ADR-014` decided
that: the review tooling measures and never edits, and the loop that does fix is
a caller of it with more than one entry point. A second copy of the caps, the
four dispositions, or the rules for deriving a count contradicts that decision,
so a caller states none of them — it calls this file.

## The contract

**What a caller supplies.**

| Input | Required | What it is |
|---|---|---|
| `--state <path>` | yes | the caller's run state file (`/teachers-ticket` writes `.gate/run.json`). The loop reads it for the branch, the head and what the run already knows, and writes its own progress back into the `loop` key of the same file. |
| `--pr <n>` | yes | the pull request under the loop. It must already exist and its head must be the branch in the state file. |
| `--ticket <path>` | no | the backlog ticket this change implements. Given, it is passed to `/teachers-review` as `--self-review T-NNN` and a `deferred` finding can name a sibling ticket. Absent, the loop runs unchanged — it simply has no ticket-bound work to do, and **what only a ticket makes possible is the caller's, not this loop's**: ticking acceptance criteria and setting a backlog `status` happen in the caller after the loop returns. |
| `--effort <level>` | yes | the level each round's review runs at, in `/code-review`'s vocabulary. The caller states it; this file names no level of its own, so the word is not written in two places that can disagree. |
| `--merge` / `--comment` | no | passed through to `/teachers-review` untouched. The merge conditions live there (`ADR-014`); this loop re-decides none of them. |

**What it returns.** One object, to the caller's context and nowhere else:

```json
{
  "exit": "converged" | "cap" | "blocked",
  "cap": "reviewRounds" | "gateRunsPerRound" | "pushesAfterOpening" | null,
  "rounds": 2,
  "undisposed": [],
  "outsideThisChange": ["lib/…: …"],
  "head": "9f2c1ab",
  "gate": "green" | "red" | "not run here",
  "deferred": ["T-041"]
}
```

- `converged` — the latest round produced no finding inside the diff.
- `cap` — a cap stopped it; `cap` names which, and `undisposed` is what is
  still open.
- `blocked` — the loop could not proceed and says why in `undisposed` (a red
  check it cannot fix, a question only the user can answer).

**Where its state lives.** `.gate/findings.json` for the rounds, in the shape
below; the `loop` key of the state file for the round number, the last head and
the exit; `.gate/ledger.jsonl` and the branch history for every count. All of it
is under `.gate/`, which is git-ignored, so a resumed session reads the same
files a fresh one would.

## The caps

They live in one module — `scripts/gate/caps.ts` — and this file states no
number of its own, because a number restated in prose goes on being right until
that module changes, after which nothing says it is wrong. Read them there:

| Cap | Bounds |
|---|---|
| `reviewRounds` | review passes over the pull request |
| `gateRunsPerRound` | `npm run gate` invocations inside one round |
| `pushesAfterOpening` | pushes after the one that opened the pull request |

**Every count is derived from a record you did not write.** The gate runs in
this round are the distinct run ids the gate itself appended to
`.gate/ledger.jsonl` since the round's timestamp; the pushes come from the
branch's own history. Only the round number is yours, in `.gate/findings.json`.
**A count held in the conversation is not a count** — that is the one thing a
compacted context is guaranteed to take. Read them; never recall them.

`npm run gate` prints every count against its cap on each run, so a cap being
approached is visible without anyone opening a file for it.

**Hitting any cap stops the loop.** Return `exit: "cap"` with what is still
open — which findings, which check, which count ran out — rather than starting
another of anything. A run of rounds that did not converge is information; one
more rarely adds any.

## The exit

**The loop ends at the first round that produces no finding inside the diff**,
and it does not run a further round to confirm that. The round that found
nothing *is* the confirmation: `/teachers-review` is read-only, so nothing the
reviewer did between the rounds could have caused the empty report, and the
round before it is the one whose fixes it measured.

Hitting a cap is the other exit. Nothing else ends the loop: not a round that
felt thorough, and not a report already drafted.

## One round

Each round is **one subagent call**, and the boundary is the point: the round's
own file reads — the diff, the documents, the code — stay in the subagent's
context and never enter the caller's. What crosses the boundary is small in both
directions.

1. **Run the round.** Launch the `teachers-review-round` agent with exactly
   three inputs: the state file path, the ticket path (or the word `none`) and
   the pull request number, plus the `--effort` level in force. It invokes

   ```sh
   /teachers-review <pr> --self-review T-NNN --effort <level>
   ```

   — or without `--self-review` when there is no ticket — and returns that
   round's findings as JSON in the `findings` shape below. Nothing else comes
   back: not the diff it read, not the documents, not its reasoning.

2. **Record the round in `.gate/findings.json` before fixing anything**, so
   round *N* and round *N+1* are two lists that can be compared:

   ```json
   {
     "rounds": [
       {
         "round": 1,
         "startedAt": "2026-09-10T11:04:00.000Z",
         "head": "9f2c1ab",
         "findings": [
           {
             "id": "R1-1",
             "location": "lib/db/queries/events.ts:42",
             "rule": "userId is the first argument of every function in lib/db/queries — CLAUDE.md, Code layout",
             "summary": "listEvents takes the range first, so a caller can omit the tenant filter.",
             "pass": "contract",
             "disposition": "fixed",
             "note": "commit 4d1e0aa"
           }
         ]
       }
     ]
   }
   ```

   `startedAt` and `head` are what the counts are measured from. **No code
   validates this file.** A validator can check that a field is not empty, never
   that it is true — a disposition recorded `fixed` against code that does not
   exist passes any validator anyone could write. What makes the file worth
   keeping is that the next round reads it, and that a resumed session can.

3. **Dispose of every finding the round reported.** A defect this change did not
   cause is not among them: `/teachers-review` drops it, and the
   `## Outside this change` section it may print is information about code the
   branch did not touch, not a list this loop owes anything. Carry that section
   into the return value, though — it is how a severe defect nobody here caused
   reaches the person who can file it. These dispositions, and each costs
   something:

   | Disposition | What it takes | What it costs |
   |---|---|---|
   | `fixed` | a commit that changes the named `file:line` | the fix has to survive the gate |
   | `rejected` | the document text that refutes the quoted rule, quoted back | having actually read the document, and being right |
   | `deferred` | a `T-NNN` that **exists** — file it, mirror it in `README.md` | the backlog carries it, and someone must do it |
   | `accepted` | the user said so, in this conversation | a question spent out of the user's attention |

   Nothing else is a disposition. "Noted", "will keep an eye on it" and silence
   are how a finding reaches `main`.

4. **Fix, then gate.** Apply the fixes on the branch in the state file as one
   commit — `T-NNN review fixes: <what>`, or `Review fixes: <what>` with no
   ticket bound — then `npm run gate`. Every failing check is in one table: fix
   them together rather than one round-trip each.

   **Gate the tree that changed, and only that one.** Before running it, read
   `.gate/last-run.json`: if its `commit` is the current `HEAD` and the tree is
   clean now (`git status --porcelain` is empty), that table still describes
   this tree and the gate does not run again. Re-running the gate against an
   unchanged tree, hoping for a different answer, is not permitted — the gate
   will still run it and still count it, because nothing here refuses a
   *measurement*, but if the tree has not changed then either the answer has not
   either or what changed is the environment, and that is worth saying out loud
   rather than re-rolling.

5. **Push, then re-review**, and write the round's outcome into the state file
   before the next round starts, so a session that dies between rounds resumes
   without re-reading anything.

## Waiting for CI

The pushed head is checked by `ci.yml`, which is the authoritative run
(`ADR-007`). **Never `sleep` to wait for it.** A sleep spends wall-clock time
to learn nothing and holds the whole context open while it does. Read the run
instead:

```sh
gh pr checks <pr> --watch --interval 30   # blocks in gh, not in the context
gh pr checks <pr>                          # one read, if the run is already finished
```

Where `gh` cannot read it — not installed, not authenticated, no pull
request — say exactly that, return `gate: "not run here"`, and **never that it
passed**.

## Definition of done

- The loop exited at a round with no finding inside the diff, or at a named cap,
  and the return value says which.
- Every finding of every round carries one of the four dispositions, and
  `.gate/findings.json` holds all of them.
- Every count in the return value was read from `.gate/ledger.jsonl`, the branch
  history or `.gate/findings.json` — none was recalled.
- Nothing was reviewed and fixed in the same context: each round's review ran in
  its own subagent, and this loop applied the fixes.
- The state file was written at the end of every round.
- What only a ticket makes possible was left to the caller, and the return value
  is what the caller reports from.
