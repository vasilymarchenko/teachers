---
id: T-016
type: ticket
title: Rate limiting on sign-in
status: done
depends_on: [T-006]
refs:
  - docs/architecture/architect-overview.md §8.3
  - docs/architecture/design/T-006-auth-boundary.md §7
  - docs/architecture/decisions/ADR-023-sign-in-failures-are-counted-in-process-per-client-address.md
---

## Goal

Limit repeated sign-in attempts before T-015 puts the app on a public host.
Which part of the flow is currently unthrottled, and why, is stated in
`design/T-006-auth-boundary.md` §7.

## Acceptance criteria

- [x] Repeated failed sign-in attempts are refused after a threshold, whether
      they arrive through the form or through `POST /api/auth/sign-in/email`.
- [x] A refused attempt tells the teacher in Ukrainian to wait — it does not
      report a wrong password, and it does not say whether the address exists.
- [x] The limit survives a restart of the web container, or the ticket records
      why an in-process counter is enough for this deployment.
- [x] The threshold, the window and where the limiter runs replace the current
      "no limit applies" paragraph in `design/T-006-auth-boundary.md` §7.

## Notes

Not in T-015's `depends_on`: the pipeline can be built first, but the app should
not be reachable from the internet until this is done.

**Why an in-process counter is enough for this deployment** (the third
criterion): there is one `web` container, so no second process holds a count of
its own, and a restart is a deploy or a host reboot — the operator's act, which
the client being limited can neither cause nor predict, and which hands it at
most five further guesses. The alternatives, their cost and the two conditions
that move the count into Postgres are in `ADR-023`.

Decided with the user before implementation: the counter lives in process
memory, attempts are counted per client address and not per e-mail address, and
the limit is 5 failed attempts in 15 minutes. The mechanics are in
`design/T-006-auth-boundary.md` §7.

Evidence for the criteria, in order: `lib/auth/signInLimit.ts:136`
(`refuseRepeatedSignIn`) with `lib/auth/signInLimit.integration.test.ts` — the
form, the route and the two "share one counter" cases; `lib/actions/auth.ts:78`
with the tests "refuses the sixth attempt though its password is right" and
"refuses an address nobody has with the same words as one that exists" in that
suite; the paragraph above and `ADR-023` §Consequences; and
`design/T-006-auth-boundary.md:201`. The line numbers are those of the
ticket's last commit on its branch.
