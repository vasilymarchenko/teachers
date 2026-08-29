# Auth boundary and the `userId` discipline

**Ticket:** `docs/backlog/T-006-auth-and-query-discipline.md`
**Status:** authoritative for T-006.

Rationale lives in `docs/architecture/architect-overview.md` §8.3 and §8.4. This
document adds no reasoning: it states the mechanics — the signatures every later
ticket calls, the shape a Server Action has to have, and exactly what the guard
accepts and rejects.

---

## 1. Modules

| File | Exports |
|---|---|
| `lib/auth/auth.ts` | `getAuth()` — the better-auth instance. Called only by `lib/auth/session.ts` and the mounted route handler. |
| `lib/auth/session.ts` | `requireUser()`, `getUser()`, `SessionUser` |
| `lib/auth/queryDiscipline.ts` | `checkSource()`, `SourceKind`, `Violation`, `ACTIONS_WITHOUT_A_SESSION` — test support only; it imports `typescript`, a devDependency, so application code must never import it |
| `lib/actions/auth.ts` | `signInAction`, `signOutAction`, `SignInState` |
| `lib/validation/signIn.ts` | `signInInput`, `SignInInput` |
| `lib/db/queries/teacher.ts` | `getTeacher(userId)` |
| `proxy.ts` | the unauthenticated-navigation redirect |

## 2. `requireUser()`

```ts
type SessionUser = { id: string; email: string; name: string };

function getUser(): Promise<SessionUser | null>;
function requireUser(): Promise<SessionUser>;
```

`requireUser()` redirects to `/sign-in` when there is no session. `redirect()`
throws, so a caller never continues without a user and the return type needs no
null branch.

`SessionUser.id` **is** the `userId` every query and mutation takes. It is a
`text` column (`design/schema.md` §5.1), so `userId: string`, never `uuid`.

`getUser()` exists for the one screen that renders both ways — the sign-in page
bouncing a teacher who is already signed in. It is not an alternative entry for
data access.

## 3. The shape of a Server Action

```ts
"use server";

export async function doThing(prevState: State, formData: FormData): Promise<State> {
  const { id: userId } = await requireUser();          // 1. boundary
  const parsed = thingInput.safeParse(fieldsOf(formData));  // 2. Zod
  if (!parsed.success) return { fieldErrors: … };
  await insertThing(userId, parsed.data);              // 3. domain / db
  revalidatePath("/…");                                // 4. revalidate
}
```

Four steps, in that order, per `architect-overview.md` §2. Two notes on the
version that exists today:

- `signInAction` is the single action that starts at step 2: it is what creates
  the session step 1 requires. It is named in `ACTIONS_WITHOUT_A_SESSION` and
  the guard exempts it by that name — adding a second name to that array is a
  decision, not a formality.
- Neither action reaches step 4. Both end in `redirect()`, which re-renders on
  its own, and T-006 introduces no data mutation to revalidate. The first
  `revalidatePath` call arrives with T-009.

## 4. Query signatures

Every function in `lib/db/queries` is `(userId: string, …rest)` and is
read-only. `getTeacher(userId)` is the first one and the pattern for the rest:

```ts
export async function getTeacher(userId: string): Promise<
  { id: string; name: string; email: string } | null
>;
```

`user` is better-auth's table, so its tenant column is `id`; every profile table
uses `user_id` and filters the same way (`design/schema.md` §1).

## 5. What the guard enforces

`lib/auth/queryDiscipline.test.ts` walks `lib/db/queries` (kind `query`),
`lib/actions` (kind `action`) and `lib/validation` (kind `validation`), skipping
`*.test.ts`, and fails on any violation. It is syntactic — `ts.createSourceFile`,
no program, no type checker.

| # | Rule | Applies to |
|---|---|---|
| 1 | Every exported function's first parameter is `userId: string` | `query` |
| 2 | Every exported function calls `requireUser()` somewhere in its body | `action`, minus `ACTIONS_WITHOUT_A_SESSION` |
| 3 | No `<expr>.get("userId")` | all three |
| 4 | No `userId` read off a parameter of an enclosing function | all three |
| 5 | No `userId` key in a `z.object({…})` | all three |

Rules 3 and 5 are additionally expressed as `no-restricted-syntax` selectors in
`eslint.config.mjs` over `app/`, `lib/` and `components/`, so they surface in the
editor. Rules 1, 2 and 4 are beyond what a selector can state; the test is the
authority for all five.

Rule 2 checks that `requireUser()` is called somewhere in the function, not that
it is the first statement — proving "first" needs ordering effects, which syntax
alone cannot establish once a helper or a branch is involved.

**What it does not prove.** That an accepted `userId` is actually used in the
`where`. A query with the right signature and no filter passes rule 1. That gap
belongs to review and to T-008's integration tests.

Closing it needs something T-006 deliberately does not decide: `getTeacher()`
calls `getDb()`, whose pool is cached on `globalThis` and never closed, so a
test of it would leave Vitest hanging — which is why the existing integration
suite uses `createTestDatabase()` and touches no query module. **How a query
module receives its database handle is T-008's to settle** (inject it, or export
a testable inner function), and until it does, `lib/db/queries` has static
checks and no integration coverage.

A per-directory test asserts the walk found at least one file, so renaming a
directory fails loudly instead of turning the suite into a no-op.

## 6. The redirect layer (`proxy.ts`)

`proxy.ts` exports `proxy(request)` and redirects to `/sign-in` when
`getSessionCookie(request)` returns nothing; it does not verify the cookie.

§8.3 calls this layer "middleware". Next.js 16 renamed the file convention from
`middleware.ts` to `proxy.ts`, and the export from `middleware` to `proxy`;
`middleware.ts` still runs but warns on every build. Same position in the
pipeline, so §8.3's reasoning carries over unchanged and the overview needs no
edit. Why the cookie is not verified here is §8.3's to answer.

Matcher — everything except `sign-in`, `api`, `_next` and any path with a file
extension:

```
/((?!(?:sign-in|api|_next)(?:$|/)|.*\.[^/]+$).*)
```

`api` is excluded because better-auth's own handler is mounted under it and must
stay reachable while signed out. Each name is anchored with `($|/)`: an
unanchored alternative also excludes `/sign-inbox` and `/apitest`.

## 7. Configuration

`lib/auth/auth.ts` registers `nextCookies()` **last** in `plugins`. It is the
`after` hook that copies better-auth's `Set-Cookie` onto Next's cookie store;
without it `signInAction` succeeds and no session cookie is ever written.

`BETTER_AUTH_SECRET` must be a real value — sign-in fails against the
`replace-me` placeholder in `.env.example`.
