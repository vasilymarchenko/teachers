---
id: T-006
type: ticket
title: Auth boundary and user_id query discipline
status: todo
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

- [ ] `lib/auth/session.ts::requireUser()` implemented over better-auth.
- [ ] Sign-in and sign-out flow works for a single seeded teacher.
- [ ] Middleware exists only as a redirect for unauthenticated navigation, and
      a comment states it is UX, not a security boundary (overview §8.3).
- [ ] Every function in `lib/db/queries` and every mutation takes `userId` as
      its first argument.
- [ ] `userId` is only ever obtained from `requireUser()`; a test or lint rule
      guards against reading it from form or request input.
- [ ] Server Actions follow the shape from overview §2:
      `requireUser` → Zod → domain/db → revalidate.

## Notes
