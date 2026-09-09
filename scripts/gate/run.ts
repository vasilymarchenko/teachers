/**
 * `npm run gate` — one entry point for "is this change checked?".
 *
 * It resolves the diff, selects the checks that diff needs, runs **all** of
 * them without short-circuiting, prints one table and writes the ledger. A lint
 * error and three red tests are one report, not three round-trips.
 *
 * It edits nothing and pushes nothing. The only thing it writes is `.gate/`,
 * which is gitignored — it reports, like the review it feeds.
 *
 * Usage:
 *   npm run gate                     the checks this diff needs
 *   npm run gate -- --all            every check, whatever changed
 *   npm run gate -- --only lint,test just these
 *   npm run gate -- --base <ref>     compare against something other than origin/main
 *   npm run gate -- --rerun test     the one permitted re-run of a red check
 *   npm run gate -- --report         the loop's state, computed from the ledger
 *   npm run gate -- --json           the run summary as JSON, nothing else
 */

import { config } from "dotenv";

import { CHECKS, checkByName, selectChecks, type Check } from "./checks";
import { exec, npm, tail, type Executed } from "./exec";
import { hygieneProblems } from "./hygiene";
import {
  appendRows,
  mayRerun,
  newRunId,
  readLedger,
  writeLastRun,
  type LedgerRow,
  type RunSummary,
} from "./ledger";
import { readFindings } from "./findings";
import { loopReport, runTable, skipNotes } from "./report";
import { buildImage, dockerAvailable, migratorSmoke } from "./smoke";
import { verifySchema } from "./verifySchema";

config({ path: ".env", quiet: true });

type Options = {
  base: string;
  all: boolean;
  only: string[] | null;
  rerun: string | null;
  report: boolean;
  json: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    base: "origin/main",
    all: false,
    only: null,
    rerun: null,
    report: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--report") options.report = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--base") options.base = argv[++i] ?? options.base;
    else if (arg === "--only") options.only = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (arg === "--rerun") options.rerun = argv[++i] ?? null;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function git(args: readonly string[]): Promise<string> {
  const { exitCode, output } = await exec("git", args);
  return exitCode === 0 ? output.trim() : "";
}

/**
 * The changed set: the ticket's `git diff --name-only origin/main...HEAD`, plus
 * whatever is not committed yet.
 *
 * The union, because a gate that ignores the edit still open in the editor is a
 * gate that says "checked" about a tree nobody has. When the base cannot be
 * resolved at all — a fresh clone with no `origin/main` — everything is
 * selected rather than nothing, and the caller is told why.
 */
async function changedPaths(
  base: string,
): Promise<{ paths: string[]; base: string; label: string }> {
  const resolved = (await git(["rev-parse", "--verify", "--quiet", base])) ? base : "";
  const committed = resolved
    ? await git(["diff", "--name-only", `${resolved}...HEAD`])
    : "";
  const uncommitted = await git(["status", "--porcelain"]);

  const paths = new Set<string>();
  for (const line of committed.split("\n")) if (line.trim()) paths.add(line.trim());
  for (const line of uncommitted.split("\n")) {
    // `XY PATH`, and `R  old -> new` for a rename.
    const path = line.slice(3).trim().split(" -> ").pop();
    if (path) paths.add(path);
  }
  return {
    paths: [...paths],
    base: resolved,
    label: resolved || `${base} (unresolved — running every check)`,
  };
}

type Outcome = { exitCode: number; output: string; skipped?: string };

/** What the routed checks need that is a property of the run, not of the check. */
type Context = {
  /** The resolved base ref, or `""` when there is none to diff against. */
  readonly base: string;
  readonly paths: readonly string[];
};

async function runCheck(check: Check, context: Context): Promise<Outcome> {
  if (check.requires === "docker" && !(await dockerAvailable())) {
    return { exitCode: 0, output: "", skipped: "docker is not reachable; CI runs this" };
  }
  if (check.requires === "database" && !process.env.DATABASE_URL) {
    return {
      exitCode: 0,
      output: "",
      skipped: "DATABASE_URL is not set; `docker compose up -d` first",
    };
  }

  if (check.kind.type === "npm") {
    return npm(check.kind.script);
  }

  switch (check.kind.id) {
    case "diff-hygiene": {
      // Both halves of the diff, for the same reason the changed set is a
      // union: a `.only` is no less committed for being uncommitted.
      const problems = hygieneProblems({
        changedPaths: context.paths,
        diff:
          (context.base ? await git(["diff", `${context.base}...HEAD`]) : "") +
          (await git(["diff", "HEAD"])),
        status: await git(["status", "--porcelain"]),
      });
      return { exitCode: problems.length === 0 ? 0 : 1, output: problems.join("\n") };
    }
    case "verify-schema":
      try {
        await verifySchema(process.env.DATABASE_URL as string);
        return { exitCode: 0, output: "schema verified\n" };
      } catch (error) {
        return { exitCode: 1, output: `${(error as Error).message}\n` };
      }
    case "image:runner":
      return buildImage("runner");
    case "image:migrator":
      return buildImage("migrator");
    case "migrator-smoke": {
      // The smoke test runs the image `image:migrator` built, so a red build
      // makes this meaningless rather than merely red.
      const built: Executed = await buildImage("migrator");
      if (built.exitCode !== 0) {
        return { exitCode: built.exitCode, output: built.output };
      }
      return migratorSmoke();
    }
  }
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  if (options.report) {
    const { text, done } = loopReport(readLedger(), readFindings());
    process.stdout.write(text + "\n");
    return done ? 0 : 1;
  }

  const commit = (await git(["rev-parse", "--short", "HEAD"])) || "unknown";
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])) || "unknown";
  const { paths, base, label } = await changedPaths(options.base);

  let selected: readonly Check[];
  let attempt: 1 | 2 = 1;

  if (options.rerun) {
    const check = checkByName(options.rerun);
    if (!check) throw new Error(`No such check: ${options.rerun}`);
    if (!mayRerun(readLedger(), check.name, commit)) {
      process.stderr.write(
        `Refusing to re-run \`${check.name}\` against ${commit}: it is not red on its ` +
          `first attempt here, or it has already had its one re-run. Exactly one ` +
          `re-run distinguishes a flake from a red check; retrying until green does not.\n`,
      );
      return 1;
    }
    selected = [check];
    attempt = 2;
  } else if (options.only) {
    selected = options.only.map((name) => {
      const check = checkByName(name);
      if (!check) throw new Error(`No such check: ${name}`);
      return check;
    });
  } else if (options.all || base === "") {
    selected = CHECKS;
  } else {
    selected = selectChecks(paths);
  }

  const runId = newRunId(new Date(), commit);
  const rows: LedgerRow[] = [];
  const failures: { name: string; output: string }[] = [];

  if (!options.json) {
    process.stdout.write(
      `gate: ${selected.length} check(s) for ${paths.length} changed path(s), ` +
        `${commit} on ${branch}, against ${label}\n\n`,
    );
  }

  for (const check of selected) {
    if (!options.json) process.stdout.write(`  running ${check.name} …`);
    const startedAt = Date.now();
    const outcome = await runCheck(check, { base, paths });
    const durationMs = Date.now() - startedAt;

    const result: LedgerRow["result"] = outcome.skipped
      ? "skipped"
      : outcome.exitCode === 0
        ? attempt === 2
          ? "flake"
          : "pass"
        : "fail";

    if (result === "fail") failures.push({ name: check.name, output: outcome.output });

    rows.push({
      kind: "check",
      run: runId,
      name: check.name,
      result,
      exitCode: outcome.skipped ? null : outcome.exitCode,
      commit,
      branch,
      at: new Date().toISOString(),
      durationMs,
      attempt,
      ...(outcome.skipped
        ? { detail: outcome.skipped }
        : result === "fail"
          ? { detail: tail(outcome.output) }
          : {}),
    });

    if (!options.json) {
      process.stdout.write(` ${result} (${(durationMs / 1000).toFixed(1)}s)\n`);
    }
  }

  const summary: RunSummary = {
    run: runId,
    commit,
    branch,
    at: new Date().toISOString(),
    base: label,
    changedPaths: paths,
    rows,
    ok: rows.every((row) => row.result !== "fail"),
  };

  appendRows(rows);
  writeLastRun(summary);

  if (options.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return summary.ok ? 0 : 1;
  }

  process.stdout.write("\n" + runTable(summary) + "\n");
  for (const note of skipNotes(summary)) process.stdout.write(`  skipped — ${note}\n`);

  for (const failure of failures) {
    process.stdout.write(`\n--- ${failure.name} ---\n${tail(failure.output, 80)}\n`);
  }

  process.stdout.write(`\nledger: .gate/ledger.jsonl\n`);
  return summary.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: Error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  },
);
