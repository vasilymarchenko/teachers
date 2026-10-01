---
id: ADR-023
title: Count failed sign-ins in the web process, per client address, inside better-auth's hooks
status: accepted
date: 2026-10-01
ticket: T-016
---

## Context

T-015 put the app on a public host, and the sign-in form was unthrottled.
better-auth 1.7.2 ships a limiter (3 requests per 10 s on `/sign-in*`, on in
production), but it runs in the router's `onRequest`
(`node_modules/better-auth/dist/api/rate-limiter/index.mjs`), so it covers the
mounted `POST /api/auth/sign-in/email` and not `auth.api.signInEmail()`, which
is what `signInAction` calls. It also limits the rate of requests, not the
number of failures: three guesses every ten seconds is 25 000 a day.

The deployment is one `web` container behind Caddy on one VPS
(`docker-compose.prod.yml`), serving one teacher. Caddy sets `X-Forwarded-For`
to the address it accepted the connection from and discards a client-supplied
one; Next leaves an incoming `x-forwarded-for` as it is
(`node_modules/next/dist/server/base-server.js`).

Three things had to be chosen: where the check runs, what an attempt is counted
against, and where the count is kept.

## Options

**Where the check runs.**

- *In `signInAction` and again in the route handler.* Two call sites that must
  be kept equal by hand; a third caller of `signInEmail()` is unlimited until
  someone remembers.
- *In Caddy.* Rate limiting is not in the stock Caddy image; it needs a custom
  build with a third-party module, and Caddy cannot tell a failed sign-in from a
  successful one — nor a Server Action POST to `/sign-in` from any other.
- *In better-auth's `hooks.before` / `hooks.after`.* These run for an
  `auth.api.*` call and for a routed request alike
  (`node_modules/better-auth/dist/api/dispatch.mjs`), which is the property
  ADR-019 already relies on for refusing a deactivated teacher.

**What an attempt is counted against.**

- *The e-mail address.* Limits guessing from any number of client addresses,
  but lets anyone who knows the teacher's address lock her out for the length of
  the window, as often as they like — on an app with one user, that is the whole
  application.
- *The client address.* Locking the teacher out takes sharing her public
  address — a school network or a mobile carrier's NAT puts many people behind
  one — rather than merely knowing her e-mail address. Whoever shares it and
  fails five times does lock her out for the rest of the window. Guessing spread
  over many addresses is limited only per address.
- *Both, with a higher ceiling per e-mail address.* Closes the distributed case
  and reopens the lock-out, at a higher price to the attacker.

**Where the count is kept.**

- *A Postgres table* — ours, or better-auth's `rateLimit` model with
  `storage: "database"`. Survives a restart. Costs a table, a migration, a write
  on every failed attempt and the pruning of expired rows.
- *The memory of the web process.* No schema. A restart forgets every count.

## Decision

Two hooks in `lib/auth/signInLimit.ts`, registered in `lib/auth/auth.ts` as
`hooks.before` and `hooks.after`, acting on the path `/sign-in/email` only.

The count is kept per client address, as `getIP()` from `better-auth/api`
resolves it, in a `Map` held on `globalThis`. A request with no resolvable
address is counted under one key shared by all such requests.

An attempt is taken in the *before* hook, ahead of the password check. The
*after* hook gives that one attempt back unless the sign-in ended in the
credential error: a success is not counted, and neither is a request better-auth
refused before reaching the password. Five attempts in a window of fifteen
minutes that opens with the first of them; the next is refused with `429` and
the code `TOO_MANY_SIGN_IN_ATTEMPTS` whatever it carries. The numbers are the
two constants at the top of that file.

better-auth's own limiter is left at its defaults.

## Consequences

**A restart of the `web` container forgets the counts.** That is accepted
because of what a restart is here: a deploy or a host reboot, both done by the
operator and neither reachable by the party being limited. Each one hands a
client at most five further guesses. There is one `web` container, so there is
no second process whose counts could disagree. **Revisit** when `web` runs as
more than one replica, or when something restarts it on a schedule an outsider
can predict or cause — then the count moves to Postgres.

**Guessing from many addresses is limited only per address, and people behind
one address share one allowance.** Both accepted over an e-mail-keyed limit,
which hands the lock-out to anyone on the internet who knows the teacher's
address; this one hands it only to someone on her own network, for fifteen
minutes at a time. **Revisit** when the logs show a distributed attempt, when
the teacher is in fact locked out from a shared network, or when accounts get a
second factor or a recovery path that makes a lock-out cheap to undo.

**A success gives back its own attempt and no more.** Clearing the address on
success would let anyone who holds an account sign in to it between guesses at
another and never reach five. The price is that a teacher who mistypes four
times and then gets in has one attempt left until the window ends, not five.

**Only a credential failure is kept.** `hooks.before` runs ahead of
better-auth's origin and CSRF checks, so a cross-site form post from the
teacher's own browser takes an attempt from her address before it is refused.
Giving back every attempt that did not end in the credential error is what
keeps a page on another site from locking her out.

**The limit trusts the proxy.** The address is whatever `X-Forwarded-For` says.
Behind Caddy that is the peer address; with the `web` port published directly,
or behind a proxy that passes a client-supplied header through, a client picks
its own key and the limit stops limiting. `docker-compose.prod.yml` does not
publish `web`'s port.

**A second proxy in front of Caddy collapses every client into one key.**
Caddy's peer is then that proxy, so the header Caddy writes is the proxy's
address — a single, valid value that `getIP()` accepts — and all clients share
one allowance: closed rather than open, and a lock-out for everyone after five
failures by anyone. Putting it right takes two settings, not one: Caddy's
`trusted_proxies`, so that it keeps the client address the outer proxy
forwarded — which makes the header a list — and better-auth's
`advanced.ipAddress.trustedProxies`, without which `getIP()` refuses a list and
every request falls under the shared `unknown` key.

**A refused attempt is refused before its password is looked at**, so a teacher
who mistypes five times waits out the window even once she remembers. The
attempt is taken before the check rather than counted after a failure because a
burst of parallel requests would otherwise all pass the check before the first
failure was recorded.

**The store is bounded** at 10 000 addresses; past that, expired windows go
first and then the oldest. An attacker holding more addresses than that is not
one a per-address limit was stopping.

**The store is on `globalThis`** because Next may instantiate a module once for
a Server Action and once for a Route Handler, and two stores would be two
allowances. `signInLimit.integration.test.ts` holds the form and the route to
one counter.
