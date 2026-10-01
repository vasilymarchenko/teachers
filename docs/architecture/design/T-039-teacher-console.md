# Teacher accounts from the console

**Ticket:** `docs/backlog/T-039-teacher-management-console.md`
**Status:** authoritative for T-039.

Rationale lives in `docs/architecture/architect-overview.md` §8.3, in
`decisions/ADR-019-teacher-accounts-are-managed-by-functions-not-the-admin-plugin.md`
and in
`decisions/ADR-020-account-command-ships-as-one-bundled-file-in-the-runner-image.md`.
This document adds no reasoning: it states the mechanics — the functions and
their results, the command's syntax and exit codes, and how the file reaches the
image.

---

## 1. Modules

| File | Exports |
|---|---|
| `lib/auth/teachers.ts` | `createTeacher()`, `setTeacherPassword()`, `deactivateTeacher()`, `activateTeacher()`, `listTeachers()`, `Teacher`, `TeacherResult`, `TeacherRefusal` |
| `lib/auth/auth.ts` | `getAuth()` gains `databaseHooks.session.create.before` and `.after` |
| `lib/auth/deactivation.ts` | `refuseDeactivatedTeacher()`, `endSessionOfDeactivatedTeacher()` — the two hooks |
| `lib/db/schema/auth.ts` | `user.deactivatedAt` — `deactivated_at timestamp`, nullable (`drizzle/0003_user_deactivated_at.sql`) |
| `scripts/teacher/cli.ts` | `run(argv, io, operations)`, `Io`, `Operations`, `EXIT_OK`, `EXIT_REFUSED`, `EXIT_USAGE`, `USAGE` |
| `scripts/teacher/password.ts` | `readHidden()`, `typeKeys()`, `Typed`, `isTerminal()`, `generatePassword()` |
| `scripts/teacher/index.ts` | the entry point: loads `.env` if there is one (`process.loadEnvFile()`, not `dotenv`), wires the real terminal and the real operations into `run()`, closes the database, exits with the code |

## 2. The operations

```ts
type Teacher = { email: string; name: string; active: boolean; createdAt: Date };

type TeacherResult =
  | { ok: true; teacher: Teacher }
  | { ok: false; reason: "invalid-email" | "email-taken" | "not-found" }
  | { ok: false; reason: "password-too-short" | "password-too-long"; min: number; max: number };

createTeacher(input: { email: string; name: string; password: string }): Promise<TeacherResult>
setTeacherPassword(email: string, password: string): Promise<TeacherResult>
deactivateTeacher(email: string): Promise<TeacherResult>
activateTeacher(email: string): Promise<TeacherResult>
listTeachers(): Promise<Teacher[]>
```

An address is trimmed and lower-cased before it is looked up or stored, which is
what better-auth does with it. A refusal means nothing was written. Anything
that is not one of the listed refusals is thrown.

| Operation | Order of work |
|---|---|
| `createTeacher` | address is an address → password within bounds → address not taken → `auth.api.signUpEmail()` → delete the session sign-up created |
| `setTeacherPassword` | password within bounds → teacher exists → `password.hash()` → `internalAdapter.updatePassword()` → `internalAdapter.deleteUserSessions()` |
| `deactivateTeacher` | teacher exists → `deactivated_at = coalesce(deactivated_at, now())` → `internalAdapter.deleteUserSessions()` |
| `activateTeacher` | teacher exists → `deactivated_at = null` |
| `listTeachers` | every `user` row, by `created_at`, then `email` |

The password bounds are read from `(await auth.$context).password.config` —
`minPasswordLength` and `maxPasswordLength`, 8 and 128 while `auth.ts` sets
neither.

## 3. The refusal at sign-in

`databaseHooks.session.create.before` — `refuseDeactivatedTeacher()` — reads
`user.deactivated_at` for the session's `userId` and, when it is set, throws

```ts
APIError.from("UNAUTHORIZED", {
  code: "INVALID_EMAIL_OR_PASSWORD",
  message: "Invalid email or password",
});
```

— the status, code and message better-auth's own `signInEmail()` produces for a
wrong password. `isBadCredentials()` therefore needs no change, and
`signInAction` returns its one Ukrainian message.

`databaseHooks.session.create.after` — `endSessionOfDeactivatedTeacher()` —
reads the column again once the session row exists and deletes that row when it
is set. It covers a sign-in that passed the first check while
`deactivateTeacher()` was running: either this second read sees the column and
deletes the row, or the column was written after the read, in which case
`deactivateTeacher()`'s sweep — which runs after its write — deletes it. That is
why `deactivateTeacher()` writes the column first and sweeps second. The sign-in
that lost the race holds a cookie for a session that no longer exists.

## 4. The command

```
teacher create <email> [--name <name>] [--generate]
teacher password <email> [--generate]
teacher deactivate <email>
teacher activate <email>
teacher list
```

| Where | Invocation |
|---|---|
| a developer's machine | `npm run teacher -- <subcommand> …` |
| the VPS | `docker compose -f docker-compose.prod.yml exec web node teacher.cjs <subcommand> …` |

**Password.** Without `--generate`: read twice by `readHidden()` (raw mode, no
echo, prompt on stderr); the two entries must match. A control character other
than Enter, Ctrl-D, Backspace and Ctrl-C — an arrow key, Delete, Tab — is a
fault, not part of the password: `typeKeys()`. With no terminal on stdin
the command refuses before calling anything. With `--generate`: 18 random bytes
as 24 base64url characters, printed once on stdout after the operation
succeeded, and not at all when it was refused. No argument and no environment
variable carries a password: a second positional and any unknown option,
`--password` included, are usage errors.

**`--name`** defaults to the address.

**`list`** prints one line per teacher, tab-separated: address, name, `active`
or `deactivated`, `created_at` as an ISO 8601 instant.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | done |
| 1 | refused, nothing written — a `TeacherRefusal`, mismatched passwords, no terminal for a typed password — or a fault, which is also printed |
| 2 | the command line was wrong; usage is printed and nothing is attempted |

Refusals and usage go to stderr; results go to stdout.

## 5. Into the image

`npm run build:teacher`:

```
esbuild scripts/teacher/index.ts --bundle --platform=node --target=node22 \
  --format=cjs --external:next --outfile=dist/teacher.cjs
```

`Dockerfile`: the `builder` stage runs it after `npm run build`; `runner` copies
`/app/dist/teacher.cjs` to `/app/teacher.cjs`. `dist/` is ignored by git and by
ESLint.

`ci.yml`, job `images`: after the migrator image has migrated the throwaway
database, the built `runner` image runs `create --generate`, `list`,
`deactivate`, `list`, `activate`, `password --generate`, then asserts that a
second `create` and a `password` with no terminal both exit non-zero. The gate
routes it as `teacher-smoke`, always skipped here
(`design/T-029-gate-and-loop.md` §2).

## 6. Tests

| Suite | Holds |
|---|---|
| `scripts/teacher/cli.test.ts` | where a password may come from; what is refused before any operation is called; the exit code of every outcome; the `list` line |
| `scripts/teacher/password.test.ts` | what a key typed at the hidden prompt does: the characters kept, Backspace, Enter, Ctrl-C, and an escape sequence or other control character refused rather than stored |
| `lib/auth/teachers.integration.test.ts` | every operation against Postgres and the real better-auth: a real sign-in after `create` and after `password`; the old password and the old sessions gone; `deactivated_at` set with the fixture scenario's rows untouched; a deactivated teacher answered exactly as a wrong password on `auth.api.signInEmail()`, on `POST /api/auth/sign-in/email` and by `signInAction`; a session inserted after the sweep ended by the second hook; `activate` restoring sign-in; the not-found and taken-address refusals writing nothing |

The two points `ADR-019` records as inferred are the tests "reaches the caller
of signInEmail() as an APIError, the wrong-password one" and "sends a session
cookie issued before deactivation to /sign-in".
