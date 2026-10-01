/**
 * `npm run teacher -- <create | password | deactivate | activate | list>` —
 * the one console entry point to teacher accounts (T-039).
 *
 * There is no sign-up screen (`lib/auth/auth.ts`), so this is how the teacher
 * who actually uses the app gets her account; `db:seed` makes only the demo
 * one, with the fixture scenario attached.
 *
 * On the VPS the same file runs as a single bundle inside the `web` container
 * — `node teacher.cjs …` — built by `npm run build:teacher` (ADR-020).
 */
import { config } from "dotenv";
import {
  activateTeacher,
  createTeacher,
  deactivateTeacher,
  listTeachers,
  setTeacherPassword,
} from "@/lib/auth/teachers";
import { closeDb } from "@/lib/db/client";
import { run } from "./cli";
import { generatePassword, isTerminal, readHidden } from "./password";

// For a developer's machine. In the container there is no `.env` — Compose sets
// the environment — and a missing file is not an error.
config({ path: ".env", quiet: true });

run(
  process.argv.slice(2),
  {
    isTerminal: isTerminal(),
    readHidden,
    generatePassword,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  },
  { createTeacher, setTeacherPassword, deactivateTeacher, activateTeacher, listTeachers },
)
  .catch((error) => {
    console.error(error);
    return 1;
  })
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  });
