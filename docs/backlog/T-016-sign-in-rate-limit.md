---
id: T-016
type: ticket
title: Rate limiting on sign-in
status: todo
depends_on: [T-006]
refs:
  - docs/architecture/architect-overview.md §8.3
  - docs/architecture/design/T-006-auth-boundary.md §7
---

## Goal

Limit repeated sign-in attempts before T-015 puts the app on a public host.
Which part of the flow is currently unthrottled, and why, is stated in
`design/T-006-auth-boundary.md` §7.

## Acceptance criteria

- [ ] Repeated failed sign-in attempts are refused after a threshold, whether
      they arrive through the form or through `POST /api/auth/sign-in/email`.
- [ ] A refused attempt tells the teacher in Ukrainian to wait — it does not
      report a wrong password, and it does not say whether the address exists.
- [ ] The limit survives a restart of the web container, or the ticket records
      why an in-process counter is enough for this deployment.
- [ ] The threshold, the window and where the limiter runs replace the current
      "no limit applies" paragraph in `design/T-006-auth-boundary.md` §7.

## Notes

Not in T-015's `depends_on`: the pipeline can be built first, but the app should
not be reachable from the internet until this is done.
