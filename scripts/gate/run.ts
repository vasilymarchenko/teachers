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
 * There is no re-run flag. A red check that is run again against the same tree
 * *is* the one permitted re-run, counted from the ledger, and a third attempt is
 * refused — see `attemptFor`. A flag would have capped only the path a careful
 * caller volunteers into.
 *
 * Usage:
 *   npm run gate                     the checks this diff needs
 *   npm run gate -- --all            every check, whatever changed
 *   npm run gate -- --only lint,test just these
 *   npm run gate -- --base <ref>     compare against something other than origin/main
 *   npm run gate -- --report         the loop's state, computed from the ledger
 *   npm run gate -- --json           the run summary as JSON, nothing else
 */

import { readFileSync } from "node:fs";

import { config } from "dotenv";

import { CHECKS, checkByName, selectChecks, type Check } from "./checks";
import { exec, npm, tail, type Executed } from "./exec";
import { porcelainPaths, treeId, untrackedPaths, wholeFileAsAdded } from "./git";
import { hygieneProblems } from "./hygiene";
import {
  appendRows,
  attemptFor,
  newRunId,
  readLedgerWithDamage,
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
  report: boolean;
  json: boolean;
  /** The ticket the findings file must belong to, for `--report`. */
  ticket: string | null;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    base: "origin/main",
    all: false,
    only: null,
    report: false,
    json: false,
    ticket: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--report") options.report = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--base") options.base = argv[++i] ?? options.base;
    else if (arg === "--ticket") options.ticket = argv[++i] ?? null;
    else if (arg === "--only") {
      options.only = (argv[++i] ?? "").split(",").filter(Boolean);
      // An empty list is truthy and would select nothing, so `--only` with a
      // typo'd or missing value would print "0 passed, 0 failed" and exit 0 —
      // a false green from the one command the whole workflow trusts.
      if (options.only.length === 0) throw new Error("--only needs at least one check name.");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/** git output with surrounding whitespace removed — safe for a single value. */
async function git(args: readonly string[]): Promise<string> {
  const { exitCode, output } = await exec("git", args);
  return exitCode === 0 ? output.trim() : "";
}

/**
 * git output with only the trailing newline removed.
 *
 * `git status --porcelain` prints `XY PATH` and either column may be a space,
 * so trimming eats the first line's leading column. Anything read column by
 * column has to come through here — `git.ts` says what that cost.
 */
async function gitRaw(args: readonly string[]): Promise<string> {
  const { exitCode, output } = await exec("git", args);
  return exitCode === 0 ? output.replace(/\r?\n$/, "") : "";
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
async function changedPaths(base: string): Promise<{
  paths: string[];
  base: string;
  label: string;
  status: string;
}> {
  const resolved = (await git(["rev-parse", "--verify", "--quiet", base])) ? base : "";
  const committed = resolved
    ? await git(["diff", "--name-only", `${resolved}...HEAD`])
    : "";
  const status = await gitRaw(["status", "--porcelain"]);

  const paths = new Set<string>();
  for (const line of committed.split("\n")) if (line.trim()) paths.add(line.trim());
  for (const path of porcelainPaths(status)) paths.add(path);

  return {
    paths: [...paths],
    base: resolved,
    label: resolved || `${base} (unresolved — running every check)`,
    status,
  };
}

type Outcome = {
  exitCode: number;
  output: string;
  /** Set when a requirement was missing, so the row is `skipped`, never `pass`. */
  skipped?: string;
  /** Set when the check was not run because it had used up its one re-run. */
  refused?: string;
};

/** What the routed checks need that is a property of the run, not of the check. */
type Context = {
  /** The resolved base ref, or `""` when there is none to diff against. */
  readonly base: string;
  readonly paths: readonly string[];
  readonly status: string;
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
      // Three sources, because a `.only` is no less focused for being
      // uncommitted — or for being in a file git has never seen. An untracked
      // file contributes no diff at all, and a newly written focused test is
      // the commonest way `.only` arrives, so its whole content is presented
      // as added lines instead.
      const asAdded = untrackedPaths(context.status)
        .filter((path) => /\.test\.tsx?$/.test(path))
        .map((path) => {
          try {
            return wholeFileAsAdded(path, readFileSync(path, "utf8"));
          } catch {
            return "";
          }
        });
      const problems = hygieneProblems({
        changedPaths: context.paths,
        diff: [
          context.base ? await gitRaw(["diff", `${context.base}...HEAD`]) : "",
          await gitRaw(["diff", "HEAD"]),
          ...asAdded,
        ].join("\n"),
        status: context.status,
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

  const commit = (await git(["rev-parse", "--short", "HEAD"])) || "unknown";
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])) || "unknown";
  const { paths, base, label, status } = await changedPaths(options.base);
  const tree = treeId(commit, status, await gitRaw(["diff", "HEAD"]));

  if (options.report) {
    const { rows, damaged } = readLedgerWithDamage();
    const { text, done } = loopReport(rows, readFindings(), {
      ticket: options.ticket,
      tree,
      expected: (base === "" ? CHECKS : selectChecks(paths)).map((check) => check.name),
      damaged,
    });
    process.stdout.write(text + "\n");
    return done ? 0 : 1;
  }

  let selected: readonly Check[];

  if (options.only) {
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

  const runId = newRunId(new Date(), tree);
  const known = readLedgerWithDamage();
  const rows: LedgerRow[] = [];
  const failures: { name: string; output: string }[] = [];

  if (!options.json) {
    if (known.damaged > 0) {
      process.stdout.write(
        `  note: ${known.damaged} unreadable line(s) in .gate/ledger.jsonl were skipped\n`,
      );
    }
    process.stdout.write(
      `gate: ${selected.length} check(s) for ${paths.length} changed path(s), ` +
        `${tree} on ${branch}, against ${label}\n\n`,
    );
  }

  for (const check of selected) {
    // Which attempt this is comes from the ledger, not from a flag. A red check
    // run again against the same tree is the one permitted re-run; a third is
    // refused without being run, because retrying until green is not permitted.
    const attempt = attemptFor([...known.rows, ...rows], check.name, tree);

    if (!options.json) process.stdout.write(`  running ${check.name} …`);
    const startedAt = Date.now();
    const outcome: Outcome =
      attempt === "capped"
        ? {
            exitCode: 1,
            output: "",
            refused:
              `already failed twice against ${tree}. Exactly one re-run tells a flake ` +
              `from a red check; a third asks the same question of the same tree. ` +
              `Fix it, or record it as a finding.`,
          }
        : await runCheck(check, { base, paths, status });
    const durationMs = Date.now() - startedAt;

    const result: LedgerRow["result"] = outcome.skipped
      ? "skipped"
      : outcome.exitCode === 0
        ? attempt === 2
          ? "flake"
          : "pass"
        : "fail";

    if (result === "fail") {
      failures.push({ name: check.name, output: outcome.refused ?? outcome.output });
    }

    rows.push({
      kind: "check",
      run: runId,
      name: check.name,
      result,
      exitCode: outcome.skipped ? null : outcome.exitCode,
      commit,
      tree,
      branch,
      at: new Date().toISOString(),
      durationMs,
      attempt: attempt === "capped" ? 2 : attempt,
      ...(outcome.skipped
        ? { detail: outcome.skipped }
        : outcome.refused
          ? { detail: `refused: ${outcome.refused}` }
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
    tree,
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
