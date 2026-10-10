/**
 * How the gate starts a check's command, on every platform it runs on.
 *
 * Checks run without a shell (`Check.argv` in `checks.ts`), so an argument such
 * as `DATABASE_URL` reaches the program exactly as written — a shell would read
 * the `&` and `?` a connection string can carry. On Windows that rules out
 * running `npm` by name: it is `npm.cmd`, a batch file, which Node starts only
 * through a shell, so the spawn failed with `ENOENT` before the check began and
 * the table showed `lint` and `typecheck` failed in 0.0s with no output.
 *
 * `npm run gate` sets `npm_execpath` to npm's own script, so `npm` is run as
 * `node <npm_execpath>`: the same npm, no shell, on every platform. Without
 * that variable — the gate started some other way — the name is left as it is.
 */

export function commandLine(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  execPath: string = process.execPath,
): [command: string, args: string[]] {
  const [command, ...args] = argv;
  const npmCli = env.npm_execpath;
  if (command === "npm" && npmCli && /npm-cli\.js$/.test(npmCli)) {
    return [execPath, [npmCli, ...args]];
  }
  return [command, args];
}

/**
 * What a finished command printed. A command that never started has no stdout
 * or stderr, and its spawn error is the only thing that says why; without it
 * the row is a failure with nothing under it.
 */
export function commandOutput(result: {
  error?: Error;
  stdout?: string | null;
  stderr?: string | null;
}): string {
  const error = result.error ? `${result.error.message}\n` : "";
  return `${error}${result.stdout ?? ""}${result.stderr ?? ""}`;
}
