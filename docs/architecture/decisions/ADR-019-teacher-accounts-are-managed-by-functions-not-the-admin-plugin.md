---
id: ADR-019
title: Manage teacher accounts through our own functions and one column, not better-auth's admin plugin
status: accepted
date: 2026-10-01
ticket: T-039
---

## Context

There is no sign-up screen, on purpose: `lib/auth/auth.ts` closes
`/sign-up/email`, and an account is created by `scripts/create-teacher.ts`
calling `auth.api.signUpEmail()` with no request and no session
(`design/T-006-auth-boundary.md` §7). That script is the whole of account
management. It takes the password from `.env`, cannot change a password, cannot
stop a teacher signing in, cannot list who exists, and cannot run on the VPS at
all (how it ships is a separate decision, taken in T-039).

What is wanted is four operations — create, set a password, deactivate and
reactivate without deleting data, list — available from a console now and from
an admin page later. No admin user exists, no role exists, and nothing may be
added to the public surface: `toNextJsHandler` serves every endpoint better-auth
defines under `/api/auth/*` and `proxy.ts` does not cover `/api`.

The facts below were read out of the installed `better-auth` 1.7.2
(`node_modules/better-auth/dist/`); nothing was executed.

- The admin plugin's `adminMiddleware` (`plugins/admin/routes.mjs:17-21`) throws
  `UNAUTHORIZED` when there is no session, with no exemption for a server-side
  call. `setUserPassword`, `banUser`, `unbanUser`, `listUsers` and `removeUser`
  all use it. Only `createUser` works without a session (`routes.mjs:153-154`).
- The plugin mounts 15 routes under `/admin/*` (`plugins/admin/admin.mjs:66-82`).
  `disabledPaths` is an exact-string match in the router's `onRequest`
  (`api/index.mjs:164-166`), with no wildcard.
- The plugin adds `role`, `banned`, `banReason`, `banExpires` to `user` and
  `impersonatedBy` to `session` (`plugins/admin/schema.mjs:2-31`).
- A ban is enforced by a `session.create.before` database hook
  (`plugins/admin/admin.mjs:33-50`) and by
  `internalAdapter.deleteUserSessions(userId)` (`routes.mjs:547`). There is no
  check on `getSession`; a live session ends because its row is gone.
- The same building blocks are reachable without the plugin:
  `(await auth.$context).password.hash()` (`context/create-context.mjs:181-189`),
  `internalAdapter.updatePassword(userId, hash)` (`db/internal-adapter.mjs:625`),
  `internalAdapter.deleteUserSessions(userId)` (`:504`), and `databaseHooks` in
  the config.
- Session cookie caching is off in this repository — `lib/auth/auth.ts` sets no
  `session` option — so every `getSession` reads the database and a deleted
  session row takes effect on the next request.

## Options

1. **The admin plugin.** Maintained upstream, and the page that comes later
   would get its endpoints for free. But four of the five operations cannot be
   called from a console without an admin session, so the console would bypass
   the plugin through the internals anyway — the plugin would be carried and not
   used. It costs five columns of which one concept is wanted, and 15 public
   routes that must each be listed in `disabledPaths` and re-audited on every
   upgrade, because a route added upstream is open by default.
2. **Route Handlers of our own under `/api`**, called by a console client now
   and by the site later. This is the "API to reuse" shape. It puts
   account-management endpoints on the public host before there is an admin
   identity to guard them with, which is the one thing the requirement rules
   out; and the site would not call them, since a mutation in this codebase is a
   Server Action calling a function (`architect-overview.md` §2).
3. **Plain functions in `lib/auth`, a console front end, one column of our
   own.** The functions do the work through better-auth's exposed internals; the
   console is the only caller today and a Server Action becomes a second caller
   later. Costs a dependency on `auth.$context` and `internalAdapter`, which are
   exposed but are not the documented public API, and a first column of our own
   on a table better-auth generates.

## Decision

Option 3.

- The operations are functions in `lib/auth/teachers.ts`. They take their input
  as arguments and return a result; they do not read `process.env`, prompt or
  print. The console command and any later admin page are callers of these
  functions and hold no account logic of their own.
- No account-management endpoint is mounted. The admin plugin is not installed.
- Deactivation is `user.deactivated_at`, a nullable timestamp — the one column
  this project adds to better-auth's tables. Set means the teacher cannot hold a
  session; every row the teacher owns is left in place.
- A deactivated teacher is refused in better-auth's own
  `databaseHooks.session.create.before`, not in `signInAction`, so the refusal
  covers `POST /api/auth/sign-in/email` as well as the form.
- Deactivating deletes the teacher's sessions through
  `internalAdapter.deleteUserSessions()`.
- A password is hashed with `auth.$context`'s `password.hash()` and written with
  `internalAdapter.updatePassword()`, so the stored value is one better-auth's
  own sign-in verifies.

## Consequences

`design/schema.md` §5.2 said "Nothing" is added to `user`; it is now one column,
and regenerating `lib/db/schema/auth.ts` from the better-auth CLI has one more
hand-applied correction to re-apply. `auth.$context` and `internalAdapter` are
internals: a better-auth upgrade can rename them, so each function needs an
integration test that signs in for real afterwards — a type-check alone does not
prove the hash is accepted.

Two things were inferred from the plugin doing the same and not run, and T-039
must prove them: that an error thrown from `session.create.before` reaches
`signInEmail()`'s caller as an `APIError` with its code intact, and that the
check holds for a session cookie issued before deactivation.

What this makes cheap: an admin page is Server Actions over functions that
already exist and are already tested, plus the one thing genuinely missing — a
role and its check.

Revisit when an admin page is actually built and needs more than these
operations — roles with permissions, impersonation, per-session revocation. At
that point an admin session exists, the objection in option 1 that the plugin
cannot be called is gone, and the comparison is between the plugin's 15 routes
and writing those features by hand. Revisit also if session cookie caching is
ever enabled: deleting session rows would then stop being immediate, and
`getUser()` would need its own `deactivatedAt` check.
