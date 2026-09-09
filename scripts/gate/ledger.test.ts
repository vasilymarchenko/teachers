import { describe, expect, it } from "vitest";

import {
  cappedChecks,
  consecutiveFailures,
  currentlyRed,
  flakes,
  mayRerun,
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
  it("is offered for a check that is red on its first attempt", () => {
    expect(mayRerun([row("test", "fail")], "test", "abc1234")).toBe(true);
  });

  it("is refused a second time — retrying until green is not permitted", () => {
    const rows = [row("test", "fail"), row("test", "fail", { attempt: 2 })];

    expect(mayRerun(rows, "test", "abc1234")).toBe(false);
  });

  it("is refused for a check that passed", () => {
    expect(mayRerun([row("test", "pass")], "test", "abc1234")).toBe(false);
  });

  it("is refused against a commit the check has not run on", () => {
    // The point of a re-run is to ask the same question of the same tree twice.
    // Against a different commit it is a first run, and a green answer proves
    // the fix rather than a flake.
    expect(mayRerun([row("test", "fail")], "test", "def5678")).toBe(false);
  });

  it("is offered again once the check is red on a later commit", () => {
    const rows = [
      row("test", "fail"),
      row("test", "fail", { attempt: 2 }),
      row("test", "fail", { commit: "def5678" }),
    ];

    expect(mayRerun(rows, "test", "def5678")).toBe(true);
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
