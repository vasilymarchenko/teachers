/**
 * `npm run gate` — the one command that decides whether a change is checked,
 * and `npm run gate -- --report`, which decides whether it may be called done.
 *
 * It edits nothing and pushes nothing; `.gate/` is the only path it writes.
 *
 * **Nothing here ever refuses to run a check.** A check this machine cannot run
 * is `skipped` with the reason, in the table and in the pull request body, and
 * a skip is never reported as a pass. `--report` refuses a *conclusion* — a
 * refused measurement would block the recovery, because the check is what tells
 * the truth and an environment fix changes no file (T-029).
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { config } from "dotenv";

import { selectChecks, unmetRequirement, type Check } from "./checks";
import { runHygiene } from "./hygiene";
import {
  appendLedger,
  counts,
  git,
  LAST_RUN_PATH,
  LEDGER_PATH,
  writeLastRun,
  type LedgerRow,
} from "./ledger";
import {
  countsLine,
  pullRequestBlock,
  table,
  type CheckOutcome,
} from "./report";

// This project keeps `DATABASE_URL` in `.env`, and loads it there —
// `drizzle.config.ts` and `vitest.integration.config.mts` both do. Without
// this, the database checks would report `skipped: DATABASE_URL is not set` on
// a machine that had just run `docker compose up -d`, telling the developer to
// do what they had already done.
config({ path: ".env", quiet: true });

/**
 * The change under review: what the branch adds to `origin/main`, plus whatever
 * is not committed yet — the gate must see a fix before it is committed, or the
 * loop of phase 7 would need a commit per attempt.
 */
function changedFiles(): string[] {
  const committed =
    git(["diff", "--name-only", "origin/main...HEAD"]) ??
    // No `origin/main` — a fresh clone, or a detached checkout in CI.
    git(["diff", "--name-only", "HEAD"]) ??
    "";
  const uncommitted = git(["diff", "--name-only", "HEAD"]) ?? "";
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [
    ...new Set(
      [committed, uncommitted, untracked]
        .flatMap((block) => block.split("\n"))
        .filter((file) => file !== ""),
    ),
  ].sort();
}

/** The last 30 lines of a failure, which is where the reason usually is. */
function tail(output: string): string {
  return output.split("\n").slice(-30).join("\n");
}

function runCheck(check: Check, files: readonly string[]): CheckOutcome {
  const startedAt = Date.now();
  const skip = unmetRequirement(check);
  if (skip !== null) {
    return {
      name: check.name,
      result: "skipped",
      exitCode: null,
      durationMs: 0,
      reason: check.skipReason ?? skip,
    };
  }

  if (check.inProcess === "hygiene") {
    const problems = runHygiene(files);
    return {
      name: check.name,
      result: problems.length === 0 ? "passed" : "failed",
      exitCode: problems.length === 0 ? 0 : 1,
      durationMs: Date.now() - startedAt,
      output: problems.join("\n"),
    };
  }

  if (check.argv === null) {
    // A check with no local command and no in-process implementation. Reported
    // rather than silently dropped, and never as a pass — dispatching on the
    // absence of `argv` alone is how `migrator-smoke` would come back green the
    // day its `ci-only` requirement is relaxed (T-030).
    return {
      name: check.name,
      result: "skipped",
      exitCode: null,
      durationMs: 0,
      reason: check.skipReason ?? "no local command for this check",
    };
  }

  const [command, ...args] =
    typeof check.argv === "function" ? check.argv() : check.argv;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    // A `docker build` or a full `next build` overruns Node's 1 MiB default,
    // and an overrun kills the child and reports it as a failure with a null
    // exit code — the value the ledger reserves for a check that never started.
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    name: check.name,
    result: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    output,
  };
}

function run(): number {
  const files = changedFiles();
  const commit = git(["rev-parse", "HEAD"]) ?? "unknown";
  // The gate checks HEAD *plus* whatever is not committed yet, so `commit`
  // alone would attribute a run to a tree it did not see. A resumed session
  // reading a green run must be able to tell "this commit was checked" from
  // "this commit plus edits that no longer exist was checked".
  const dirty = (git(["status", "--porcelain"]) ?? "") !== "";
  const selected = selectChecks(files);
  const runId = `${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;

  console.log(
    `gate: ${selected.length} checks for ${files.length} changed files on ` +
      `${commit.slice(0, 7)}${dirty ? " plus uncommitted work" : ""}`,
  );

  const outcomes: CheckOutcome[] = [];
  for (const check of selected) {
    process.stdout.write(`  → ${check.name}\n`);
    // Every selected check runs. Short-circuiting is what turns one report into
    // three round-trips.
    outcomes.push(runCheck(check, files));
  }

  const at = new Date().toISOString();
  const rows: LedgerRow[] = outcomes.map((outcome) => ({
    runId,
    at,
    commit,
    dirty,
    check: outcome.name,
    result: outcome.result,
    exitCode: outcome.exitCode,
    ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
  }));
  appendLedger(rows);
  writeLastRun({
    runId,
    at,
    commit,
    dirty,
    changedFiles: files,
    // The tail, not the whole buffer: `runCheck` allows a check up to 64 MiB of
    // output, and a `docker build` or a full `next build` uses a good deal of
    // it. Persisting all of it would leave a pretty-printed file of megabytes
    // that `--report` and `--pr-block` re-parse on every invocation, to read
    // five short fields out of each check.
    checks: outcomes.map((outcome) =>
      outcome.output === undefined
        ? outcome
        : { ...outcome, output: tail(outcome.output) },
    ),
  });

  const failed = outcomes.filter((outcome) => outcome.result === "failed");
  for (const failure of failed) {
    console.log(`\n─── ${failure.name} ───\n${tail(failure.output ?? "")}`);
  }

  console.log(`\n${table(outcomes)}\n`);
  console.log(countsLine(counts()));
  console.log(`ledger: ${LEDGER_PATH} · last run: ${LAST_RUN_PATH}`);

  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    return 1;
  }
  console.log("\nAll selected checks passed. Skips above are not passes.");
  return 0;
}

interface LastRun {
  commit: string;
  dirty?: boolean;
  checks: CheckOutcome[];
}

/** The commit `--report` is being asked about. */
function head(): string {
  return git(["rev-parse", "HEAD"]) ?? "unknown";
}

function readLastRun(): LastRun | null {
  try {
    return JSON.parse(readFileSync(LAST_RUN_PATH, "utf8")) as LastRun;
  } catch {
    return null;
  }
}

/**
 * `--report`: may this be called done? It runs no check — it reads what the
 * checks already said, the counts, and the pull request's own run.
 */
function report(): number {
  const blockers: string[] = [];

  const last = readLastRun();
  if (last === null) {
    blockers.push(`no gate run recorded in ${LAST_RUN_PATH} — run \`npm run gate\``);
  } else {
    const failed = last.checks.filter((check) => check.result === "failed");
    if (failed.length > 0) {
      blockers.push(
        `the last gate run was red: ${failed.map((c) => c.name).join(", ")}`,
      );
    }
    if (last.dirty) {
      blockers.push("the last gate run included uncommitted work");
    }
    // `run()` records the commit precisely so a run can be attributed to a
    // tree. Without this, gating a clean tree at A and then committing B
    // without re-gating reports B as checked on the strength of A's run — and
    // while B is unpushed, `gh pr checks` is still answering about A, so that
    // backstop does not catch it either.
    const now = head();
    if (last.commit !== now) {
      blockers.push(
        `the last gate run was against ${last.commit.slice(0, 7)}, not ` +
          `${now.slice(0, 7)} — re-run \`npm run gate\``,
      );
    }
    const skipped = last.checks.filter((check) => check.result === "skipped");
    if (skipped.length > 0) {
      // Named, never counted as passes — CI is the authority on these.
      console.log(
        `not run here: ${skipped.map((c) => `${c.name} (${c.reason})`).join("; ")}`,
      );
    }
  }

  for (const [name, count] of Object.entries(counts())) {
    if (count.exceeded) {
      blockers.push(
        `cap exceeded: ${name} is ${count.value}, cap is ${count.cap} (${count.derivation})`,
      );
    }
  }

  const ci = pullRequestChecks();
  console.log(`ci: ${ci.summary}`);
  if (ci.state !== "passing") {
    blockers.push(`CI on the pushed head: ${ci.summary}`);
  }

  console.log(countsLine(counts()));

  if (blockers.length > 0) {
    console.log(`\nNot done:\n${blockers.map((b) => `  - ${b}`).join("\n")}`);
    return 1;
  }
  console.log("\nNo cap exceeded and CI is green on the pushed head.");
  return 0;
}

/**
 * `gh pr checks` on the pushed head — the last gate, because `ci.yml` is the
 * authoritative one (ADR-007). Where `gh` cannot read it, this says so; it
 * never says it passed.
 */
function pullRequestChecks(): { state: string; summary: string } {
  const result = spawnSync("gh", ["pr", "checks"], { encoding: "utf8" });
  if (result.error !== undefined) {
    return { state: "unreadable", summary: "unreadable — gh is not available" };
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status === 0) return { state: "passing", summary: "green" };
  // `gh pr checks` exits 8 while any check is still running. Deliberately not
  // `--required`: with no branch protection yet (`T-025`), nothing on this
  // repository is a *required* check, and `--required` would then report the
  // absence of requirements rather than the state of the `ci.yml` run — red
  // forever, for a repository that is neither red nor unreadable.
  if (result.status === 8 || /pending|in progress|no checks/i.test(output)) {
    return { state: "pending", summary: `pending or absent — ${tail(output)}` };
  }
  if (/not found|no pull requests|authentication|auth|gh auth login/i.test(output)) {
    return { state: "unreadable", summary: `unreadable — ${tail(output)}` };
  }
  return { state: "failing", summary: `red — ${tail(output)}` };
}

const args = process.argv.slice(2);
if (args.includes("--pr-block")) {
  // Phase 6 pastes this into the pull request body.
  const last = readLastRun();
  if (last === null) {
    console.error(
      `No gate run recorded in ${LAST_RUN_PATH}. Run \`npm run gate\` first.`,
    );
    process.exitCode = 1;
  } else {
    // The run's own commit, never `git rev-parse HEAD`: committing the work
    // between the run and the paste would publish a run against one tree as a
    // statement about another.
    console.log(pullRequestBlock(last.checks, last.commit, last.dirty ?? false));
  }
} else {
  // `process.exitCode` rather than `process.exit()`: stdout is asynchronous
  // when it is a pipe, and exiting discards whatever is still buffered — so
  // `npm run gate | tee`, or any agent capturing the output, could lose the
  // tail of the very table that says which checks failed while the exit code
  // still said 1. Nothing here holds the event loop open, so the process still
  // exits as soon as the work is done.
  process.exitCode = args.includes("--report") ? report() : run();
}
