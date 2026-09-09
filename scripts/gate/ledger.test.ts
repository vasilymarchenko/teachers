import { describe, expect, it } from "vitest";

import {
  attemptFor,
  readLedgerLines,
  cappedChecks,
  consecutiveFailures,
  currentlyRed,
  flakes,
  MAX_FIX_ATTEMPTS,
  type CheckResult,
  type LedgerRow,
} from "./ledger";

/**
 * The counters the loop's caps are made of.
 *
 * These are the whole reason the ledger is a file rather than a memory: a cap
 * that is enforced by counting rows holds across a compaction, and one that is
 * enforced by the agent remembering how many times it has tried does not.
 */

let sequence = 0;

function row(
  name: string,
  result: CheckResult,
  overrides: Partial<LedgerRow> = {},
): LedgerRow {
  sequence += 1;
  return {
    kind: "check",
    run: `run-${sequence}`,
    name,
    result,
    exitCode: result === "fail" ? 1 : result === "skipped" ? null : 0,
    commit: "abc1234",
    tree: "abc1234",
    branch: "claude/ticket-t-026-x",
    at: new Date(Date.UTC(2026, 8, 9, 12, 0, sequence)).toISOString(),
    durationMs: 1000,
    attempt: 1,
    ...overrides,
  };
}

describe("consecutive failures", () => {
  it("counts back from the most recent row for that check", () => {
    const rows = [row("test", "fail"), row("test", "fail")];

    expect(consecutiveFailures(rows, "test")).toBe(2);
  });

  it("is not disturbed by other checks failing in between", () => {
    const rows = [row("test", "fail"), row("lint", "fail"), row("test", "fail")];

    expect(consecutiveFailures(rows, "test")).toBe(2);
  });

  it("resets on anything that is not a failure", () => {
    // A green run, a flake and a skip all mean the check has stopped being the
    // thing blocking the loop, so none of them should carry an old streak into
    // the next failure.
    for (const result of ["pass", "flake", "skipped"] as const) {
      const rows = [row("test", "fail"), row("test", result), row("test", "fail")];

      expect(consecutiveFailures(rows, "test")).toBe(1);
    }
  });

  it("is zero for a check that has never run", () => {
    expect(consecutiveFailures([row("lint", "fail")], "build")).toBe(0);
  });
});

describe("the fix cap", () => {
  it("is not reached before the third failure", () => {
    const rows = [row("test", "fail"), row("test", "fail")];

    expect(MAX_FIX_ATTEMPTS).toBe(3);
    expect(cappedChecks(rows)).toEqual([]);
  });

  it("names the check that reached it", () => {
    const rows = [row("test", "fail"), row("test", "fail"), row("test", "fail")];

    expect(cappedChecks(rows)).toEqual(["test"]);
  });
});

describe("the one permitted re-run", () => {
  it("is attempt 1 for a check that has never run against this tree", () => {
    expect(attemptFor([], "test", "abc1234")).toBe(1);
  });

  it("is attempt 2 for a check that is red on its first attempt", () => {
    expect(attemptFor([row("test", "fail")], "test", "abc1234")).toBe(2);
  });

  it("is capped the third time — retrying until green is not permitted", () => {
    const rows = [row("test", "fail"), row("test", "fail", { attempt: 2 })];

    expect(attemptFor(rows, "test", "abc1234")).toBe("capped");
  });

  it("counts a plain second run, not only an opt-in one", () => {
    // The whole point. An earlier version made the re-run a flag, so a second
    // ordinary `npm run gate` at the same tree recorded a fresh `pass` and the
    // rule applied only to the path a careful caller volunteered into.
    const rows = [row("test", "fail")];

    expect(attemptFor(rows, "test", "abc1234")).toBe(2);
  });

  it("is attempt 1 again once the check has gone green", () => {
    const rows = [row("test", "fail"), row("test", "pass", { attempt: 2 })];

    expect(attemptFor(rows, "test", "abc1234")).toBe(1);
  });

  it("is attempt 1 for a tree the check has not failed on", () => {
    // An edit changes the tree, so fixing the code resets the count — which is
    // why the rule is keyed on the tree and not on the commit or the run.
    const rows = [row("test", "fail"), row("test", "fail", { attempt: 2 })];

    expect(attemptFor(rows, "test", "abc1234+deadbeef")).toBe(1);
  });

  it("does not let another check's failures cap this one", () => {
    const rows = [row("lint", "fail"), row("lint", "fail", { attempt: 2 })];

    expect(attemptFor(rows, "test", "abc1234")).toBe(1);
  });
});

describe("what the report reads back", () => {
  it("reports a check red only if its most recent row is red", () => {
    const rows = [row("test", "fail"), row("test", "pass"), row("lint", "fail")];

    expect(currentlyRed(rows)).toEqual(["lint"]);
  });

  it("keeps a flake visible rather than folding it into a pass", () => {
    const rows = [row("test", "fail"), row("test", "flake", { attempt: 2 })];

    expect(currentlyRed(rows)).toEqual([]);
    expect(flakes(rows).map((r) => r.name)).toEqual(["test"]);
  });
});

describe("reading a damaged ledger", () => {
  it("keeps the rows it can read and counts the ones it cannot", () => {
    // The ledger is the loop's only memory. An appendFileSync interrupted
    // mid-write would otherwise make every later gate and every report exit 2
    // on a bare "Unexpected end of JSON input", with nothing to recover from.
    const good = JSON.stringify(row("lint", "pass"));
    const truncated = '{"kind":"check","name":"tes';
    const raw = [good, truncated, good, ""].join("\n");

    const { rows, damaged } = readLedgerLines(raw);

    expect(rows).toHaveLength(2);
    expect(damaged).toBe(1);
  });

  it("reads an empty ledger as no rows and no damage", () => {
    expect(readLedgerLines("\n\n")).toEqual({ rows: [], damaged: 0 });
  });
});
