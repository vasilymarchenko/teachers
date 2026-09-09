/**
 * Creates one real teacher account with no fixture data — the counterpart to
 * `db:seed`, which always seeds the demo scenario alongside its user
 * (`docs/architecture/design/expand-fixtures.md` §3). There is no sign-up
 * screen (`lib/auth/auth.ts`), so this is the only way to provision the
 * teacher who actually uses the app: she starts on an empty `/year` screen
 * and enters her own data through the UI.
 */
import { config } from "dotenv";
import { getAuth } from "@/lib/auth/auth";

config({ path: ".env", quiet: true });

const email = process.env.TEACHER_EMAIL;
const password = process.env.TEACHER_PASSWORD;

if (!email || !password) {
  throw new Error("Set TEACHER_EMAIL and TEACHER_PASSWORD before running this script.");
}

// Built here, after the guard, rather than read inside `main`: the guard
// narrows these two to `string` at module scope, and that narrowing does not
// reach into a function body. better-auth requires a name, and the address is
// the sensible stand-in when none is given.
const credentials = {
  email,
  password,
  name: process.env.TEACHER_NAME ?? email,
};

async function main() {
  const signUp = await getAuth().api.signUpEmail({ body: credentials });
  console.log(`Created teacher ${credentials.email} (user ${signUp.user.id}).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
