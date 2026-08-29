---
id: T-006
type: ticket
title: Auth boundary and user_id query discipline
status: done
depends_on: [T-004]
refs:
  - docs/architecture/architect-overview.md §8.3
  - docs/architecture/architect-overview.md §8.4
---

## Goal

Put the authorisation boundary where the data is, and establish the `userId`
convention from the first query — retrofitting it later is the expensive part of
any move to multiple users.

## Acceptance criteria

- [x] `lib/auth/session.ts::requireUser()` implemented over better-auth.
- [x] Sign-in and sign-out flow works for a single seeded teacher.
- [x] Middleware exists only as a redirect for unauthenticated navigation, and
      a comment states it is UX, not a security boundary (overview §8.3).
- [x] Every function in `lib/db/queries` and every mutation takes `userId` as
      its first argument.
- [x] `userId` is only ever obtained from `requireUser()`; a test or lint rule
      guards against reading it from form or request input.
- [x] Server Actions follow the shape from overview §2:
      `requireUser` → Zod → domain/db → revalidate.

## Notes

Mechanics — `requireUser()`'s signature, the four-step Server Action shape, the
five rules the guard enforces and the middleware matcher — are stated in
`docs/architecture/design/T-006-auth-boundary.md`.

The last criterion is met with one qualification, recorded in that document §3:
`signOutAction` follows `requireUser` → db → navigation, and `signInAction` is
the one action that cannot begin at the boundary because it creates the session.
Neither reaches `revalidate` — both end in `redirect()`, and T-006 adds no data
mutation to revalidate. The first `revalidatePath` call arrives with T-009.

`getTeacher()` has static checks but no integration test: it calls `getDb()`,
whose pool never closes, and choosing how a query module takes a database handle
so it can be tested belongs to T-008, which builds the rest of them. Recorded in
the design document §5.

Out of scope, no ticket opened: sign-up UI (the seed creates the teacher),
password reset, and rate limiting on sign-in. The last one needs a ticket before
T-015 puts the app on a public host.
