---
id: T-022
type: ticket
title: Convention test — every UPDATE in lib/actions checks the rows it matched
status: done
depends_on: [T-009]
refs:
  - docs/architecture/design/T-009-year-setup.md §5
  - docs/architecture/architect-overview.md §8.2
  - lib/auth/queryDiscipline.test.ts
---

## Goal

`docs/architecture/design/T-009-year-setup.md` §5 states the rule:

> | an UPDATE that matched no row (deleted in another tab) | the action, via
> `.returning()` | Drizzle reports success for an UPDATE that matched nothing |

It is invisible at the call site — a `.update()` that forgets `.returning()`
looks exactly like one that has it, compiles, passes every test, and fails only
against a concurrent delete that no test performs. Two of the four update
actions written for T-009 missed it, and both were found by reading the diff
rather than by the gate. That is the signature of a check that belongs in the
suite: mechanical, silent when violated, and already written down.

The repository has the harness for it. `lib/auth/queryDiscipline.test.ts`
already walks a directory, parses each file and reports violations of the §8.4
`userId` rule with the offending file named; this is the same shape of check
over `lib/actions`.

## Acceptance criteria

- [x] A test asserts that every `.update(` chain in `lib/actions/**` either
      chains `.returning(` or is followed by an explicit row-count check, and
      names the file and the offending line when it fails.
- [x] It fails against a deliberately broken fixture — a `.update()` chain with
      no `.returning()` — and passes against the four real update actions, so a
      green run means the check ran rather than matched nothing.
- [x] It flags nothing in `lib/actions` as it stands: the sketch below was run
      against the T-009 branch before the fixes and reported exactly the two
      real defects and no others.
- [x] It runs in `npm test` — no database, no network. The check is over source
      text or its AST, like `queryDiscipline.test.ts`.
- [x] The rule the test enforces is the one §5 states, quoted in the test file
      so a future reader can tell the check from an opinion.

## Notes

Raised by the review of T-009 (PR #16), phase 6 — "a check that has now fired
twice belongs in a lint rule or a convention test, not in a reviewer's
attention". The two occasions are `updateAcademicYearAction` and
`updateWeekdayRuleAction`, both fixed in that PR.

The sketch, run against the branch before the fixes, reported exactly:

```
lib/actions/academicYear.ts:170  MISSING .returning()
lib/actions/weekdayRules.ts:201  MISSING .returning()
```

No false positives on the two actions that had it right, so the rule as phrased
does not need narrowing before it is implemented properly.

Two things the implementation has to decide, neither settled here:

- **`.returning()` is necessary, not sufficient.** `updateAcademicYearAction`
  needs the empty result to *throw*, because its anchor upsert shares a
  transaction and has to roll back with it; the other three return a message.
  A test that only looks for the token accepts a `.returning()` whose result is
  discarded. Checking that the result is bound and read is the stricter and more
  useful version, and probably wants the TypeScript AST rather than a regex.
- **Whether it should cover `.delete()` too.** A delete that matched nothing is
  usually benign — the row was already gone, which is what the teacher wanted —
  so the rule as written does not ask for it. Worth confirming rather than
  extending by analogy.

**Both decided when the work was done.** The checker is
`lib/db/updateDiscipline.ts`, walked over `lib/actions` by
`lib/db/updateDiscipline.test.ts`.

- It is the strict version, over the TypeScript AST: a chain passes when its
  `.returning()` result is read where it stands or bound to a name that is
  then read; a chain without `.returning()` passes only if `count` is read off
  its result. A `.returning()` whose result is discarded, or handed somewhere
  it cannot be seen being read — an argument, a `return` — is reported.
- `.delete()` and `onConflictDoUpdate` are not checked. The DELETE rule of
  `docs/architecture/design/T-010-weekly-template-editor.md` §4 is not
  enforced by this test.

Run over `lib/actions` as it stood on the commit before T-009's review fixes
(`4835092^`), it reports the same two lines as the sketch above and nothing
else.
