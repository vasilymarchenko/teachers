/**
 * The console front end of `lib/auth/teachers.ts` — T-039, ADR-019.
 *
 * Arguments in, an exit code out. It holds no account logic: it parses, obtains
 * a password where one is needed, calls one function and says what came back.
 * The terminal and the operations are passed in, so `cli.test.ts` drives this
 * without a database and without a keyboard; `index.ts` passes the real ones.
 *
 * Syntax, exit codes and the wording are stated in
 * `docs/architecture/design/T-039-teacher-console.md`.
 */
import type { Teacher, TeacherRefusal, TeacherResult } from "@/lib/auth/teachers";

/** What the command needs from the terminal it runs in. */
export type Io = {
  /** Whether a password can be typed without being shown. */
  isTerminal: boolean;
  /** Reads one line without echoing it. Only called when `isTerminal`. */
  readHidden(prompt: string): Promise<string>;
  generatePassword(): string;
  out(line: string): void;
  err(line: string): void;
};

/** The five operations, as `lib/auth/teachers.ts` exports them. */
export type Operations = {
  createTeacher(input: { email: string; name: string; password: string }): Promise<TeacherResult>;
  setTeacherPassword(email: string, password: string): Promise<TeacherResult>;
  deactivateTeacher(email: string): Promise<TeacherResult>;
  activateTeacher(email: string): Promise<TeacherResult>;
  listTeachers(): Promise<Teacher[]>;
};

export const EXIT_OK = 0;
/** The operation was understood and refused; nothing was written. */
export const EXIT_REFUSED = 1;
/** The command line itself was wrong; nothing was attempted. */
export const EXIT_USAGE = 2;

export const USAGE = `Usage:
  teacher create <email> [--name <name>] [--generate]
  teacher password <email> [--generate]
  teacher deactivate <email>
  teacher activate <email>
  teacher list

A password is never given as an argument or read from the environment. It is
typed at a prompt that does not echo, twice — or, with --generate, made by the
command and printed once.`;

type Parsed = { positionals: string[]; name?: string; generate: boolean };

class UsageError extends Error {}

function parse(args: string[], allowed: { name?: boolean; generate?: boolean }): Parsed {
  const parsed: Parsed = { positionals: [], generate: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--generate" && allowed.generate) {
      parsed.generate = true;
    } else if (arg === "--name" && allowed.name) {
      const value = args[++i];
      if (value === undefined) throw new UsageError("--name needs a value.");
      parsed.name = value;
    } else if (arg.startsWith("--")) {
      throw new UsageError(`Unknown option ${arg}.`);
    } else {
      parsed.positionals.push(arg);
    }
  }
  return parsed;
}

/**
 * Exactly one positional: the address. A second one is refused rather than
 * ignored — the likeliest second word after an address is a password, and a
 * password on the command line is in the shell history and the process list.
 */
function onlyEmail(parsed: Parsed): string {
  const [email, ...rest] = parsed.positionals;
  if (email === undefined) throw new UsageError("An email address is required.");
  if (rest.length > 0) {
    throw new UsageError(
      "Too many arguments. A password is never given as an argument — it is typed at the prompt, or made with --generate.",
    );
  }
  return email;
}

type ObtainedPassword = { password: string; generated: boolean } | { refused: string };

async function obtainPassword(generate: boolean, io: Io): Promise<ObtainedPassword> {
  if (generate) return { password: io.generatePassword(), generated: true };
  if (!io.isTerminal) {
    return {
      refused:
        "No terminal is attached, so a password cannot be typed without being shown. Run this in a terminal, or pass --generate.",
    };
  }
  const first = await io.readHidden("Password: ");
  const second = await io.readHidden("Password again: ");
  if (first !== second) return { refused: "The two passwords differ. Nothing was changed." };
  return { password: first, generated: false };
}

function describeRefusal(refusal: TeacherRefusal, email: string): string {
  switch (refusal.reason) {
    case "invalid-email":
      return `${email} is not an email address. Nothing was written.`;
    case "email-taken":
      return `A teacher with the address ${email} already exists. Nothing was written.`;
    case "not-found":
      return `There is no teacher with the address ${email}. Nothing was written.`;
    case "password-too-short":
    case "password-too-long":
      return `The password must be ${refusal.min} to ${refusal.max} characters long. Nothing was written.`;
  }
}

function describeTeacher(teacher: Teacher): string {
  return [
    teacher.email,
    teacher.name,
    teacher.active ? "active" : "deactivated",
    teacher.createdAt.toISOString(),
  ].join("\t");
}

export async function run(argv: string[], io: Io, operations: Operations): Promise<number> {
  const [command, ...args] = argv;

  try {
    switch (command) {
      case "create":
      case "password": {
        const parsed = parse(args, { name: command === "create", generate: true });
        const email = onlyEmail(parsed);

        const obtained = await obtainPassword(parsed.generate, io);
        if ("refused" in obtained) {
          io.err(obtained.refused);
          return EXIT_REFUSED;
        }

        const result =
          command === "create"
            ? await operations.createTeacher({
                email,
                // better-auth requires a name, and the address is the sensible
                // stand-in when none is given.
                name: parsed.name ?? email,
                password: obtained.password,
              })
            : await operations.setTeacherPassword(email, obtained.password);
        if (!result.ok) {
          io.err(describeRefusal(result, email));
          return EXIT_REFUSED;
        }

        io.out(
          command === "create"
            ? `Created teacher ${result.teacher.email}.`
            : `Set a new password for ${result.teacher.email} and ended every session.`,
        );
        if (obtained.generated) io.out(`Password (shown once): ${obtained.password}`);
        return EXIT_OK;
      }

      case "deactivate":
      case "activate": {
        const email = onlyEmail(parse(args, {}));
        const result =
          command === "deactivate"
            ? await operations.deactivateTeacher(email)
            : await operations.activateTeacher(email);
        if (!result.ok) {
          io.err(describeRefusal(result, email));
          return EXIT_REFUSED;
        }
        io.out(
          command === "deactivate"
            ? `Deactivated ${result.teacher.email}: every session is ended and sign-in is refused. No data was deleted.`
            : `Activated ${result.teacher.email}: sign-in works again.`,
        );
        return EXIT_OK;
      }

      case "list": {
        if (parse(args, {}).positionals.length > 0) {
          throw new UsageError("list takes no arguments.");
        }
        for (const teacher of await operations.listTeachers()) io.out(describeTeacher(teacher));
        return EXIT_OK;
      }

      default:
        throw new UsageError(
          command === undefined ? "A subcommand is required." : `Unknown subcommand ${command}.`,
        );
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(error.message);
      io.err(USAGE);
      return EXIT_USAGE;
    }
    throw error;
  }
}
