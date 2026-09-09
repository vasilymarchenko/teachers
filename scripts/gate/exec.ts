/**
 * Running a child process and keeping what it said.
 *
 * Output is captured rather than inherited: the gate prints one table, and a
 * failing check's output belongs under that table where it can be read, not
 * interleaved with three other checks' progress bars. The tail of it goes into
 * the ledger row, so a resumed session can see why a check was red without
 * re-running it.
 */

import { spawn } from "node:child_process";

export type Executed = {
  readonly exitCode: number;
  readonly output: string;
};

/** How much of a failing check's output the ledger keeps. */
export const LEDGER_TAIL_LINES = 40;

export function tail(output: string, lines = LEDGER_TAIL_LINES): string {
  const all = output.trimEnd().split("\n");
  return all.slice(Math.max(0, all.length - lines)).join("\n");
}

/**
 * Runs a command and resolves with its exit code and everything it printed.
 *
 * `shell` is opt-in and used for exactly one thing: `npm` on Windows is
 * `npm.cmd`, a batch file, and `spawn` has refused to launch one without a
 * shell since the Node fix for CVE-2024-27980. `git` and `docker` are real
 * executables and are launched directly. Where the shell is used the command is
 * passed as one already-joined string rather than as an argv array — that is
 * what Node's DEP0190 asks for, and it is only safe because every npm argument
 * this file passes is a literal from the check table with no space in it.
 */
export function exec(
  command: string,
  args: readonly string[],
  options: { readonly env?: NodeJS.ProcessEnv; readonly shell?: boolean } = {},
): Promise<Executed> {
  const shell = options.shell ?? false;
  if (shell && args.some((arg) => /[\s"'`$&|<>^]/.test(arg))) {
    throw new Error(`Refusing to pass ${args.join(" ")} through a shell unquoted.`);
  }

  return new Promise((resolve) => {
    const child = shell
      ? spawn([command, ...args].join(" "), {
          shell: true,
          env: { ...process.env, ...options.env },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn(command, args, {
          env: { ...process.env, ...options.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

    child.on("error", (error) => {
      resolve({ exitCode: 127, output: `${output}${error.message}\n` });
    });
    child.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

/** `npm run <script>`, or `npm test` — the one script npm does not need `run` for. */
export function npm(script: string): Promise<Executed> {
  return exec("npm", script === "test" ? ["test"] : ["run", script], {
    shell: process.platform === "win32",
  });
}
