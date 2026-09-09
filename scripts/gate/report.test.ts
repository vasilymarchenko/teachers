import { describe, expect, it } from "vitest";

import { loopReport, type ReportContext } from "./report";
import type { CheckResult, LedgerRow } from "./ledger";
import type { Finding, FindingsFile } from "./findings";

/**
 * `loopReport` is the thing that decides "done", so every way it could say yes
 * when the answer is no belongs here.
 *
 * `.gate/` outlives a branch and a ticket, which is what makes most of these
 * possible: without scoping, the report reads the *last* ticket's evidence and
 * announces the current one converged before it has had a review round.
 */

const TREE = "abc1234";

let sequence = 0;

function row(
  name: string,
  result: CheckResult,
  overrides: Partial<LedgerRow> = {},
): LedgerRow {
  sequence += 1;
  return {
    kind: "check",
    run: "run-1",
    name,
    result,
    exitCode: result === "fail" ? 1 : result === "skipped" ? null : 0,
    commit: "abc1234",
    tree: TREE,
    branch: "claude/ticket-t-026-x",
    at: new Date(Date.UTC(2026, 8, 9, 12, 0, sequence)).toISOString(),
    durationMs: 1000,
    attempt: 1,
    ...overrides,
  };
}

const finding: Finding = {
  id: "R1-1",
  file: "lib/a.ts:1",
  rule: "some document says so",
  summary: "it does not",
  source: "contract",
  disposition: "fixed",
  evidence: "abc1234",
};

const findings = (overrides: Partial<FindingsFile> = {}): FindingsFile => ({
  ticket: "T-026",
  rounds: [{ round: 1, at: "2026-09-09T12:00:00.000Z", commit: "abc1234", findings: [finding] }],
  ...overrides,
});

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
  ticket: "T-026",
  tree: TREE,
  expected: ["lint", "test"],
  ...overrides,
});

const green = [row("lint", "pass"), row("test", "pass")];

describe("the loop is done", () => {
  it("when every routed check is green and every finding is disposed", () => {
    const { done, text } = loopReport(green, findings(), context());

    expect(done).toBe(true);
    expect(text).toContain("Loop converged");
  });
});

describe("the loop is not done", () => {
  const notDone = (
    rows: readonly LedgerRow[],
    file: FindingsFile | null,
    ctx: ReportContext,
    because: string,
  ) => {
    const { done, text } = loopReport(rows, file, ctx);

    expect(done).toBe(false);
    expect(text).toContain(because);
  };

  it("when no gate has run against the tree that is checked out", () => {
    // The rows are green — for a tree nobody has. Committing two more times
    // without re-gating used to read as converged.
    notDone(green, findings(), context({ tree: "deadbee" }), "no gate has run");
  });

  it("when a routed check has no row for this tree", () => {
    notDone(green, findings(), context({ expected: ["lint", "test", "build"] }), "`build`");
  });

  it("when a routed check is red", () => {
    notDone([row("lint", "pass"), row("test", "fail")], findings(), context(), "red check");
  });

  it("when a routed check was skipped — a skip is never a pass", () => {
    notDone(
      [row("lint", "pass"), row("test", "skipped", { detail: "no docker" })],
      findings(),
      context(),
      "was skipped",
    );
  });

  it("when the findings file records no round at all", () => {
    // An empty rounds array has nothing undisposed because it has nothing, and
    // read naively that is indistinguishable from having finished.
    notDone(green, findings({ rounds: [] }), context(), "records no review round");
  });

  it("when there is no findings file at all", () => {
    notDone(green, null, context(), "no findings file");
  });

  it("when the findings file belongs to another ticket", () => {
    // The case that makes this scoping necessary: T-026 converged, T-027 starts,
    // and `.gate/findings.json` still holds T-026's disposed rounds.
    notDone(green, findings({ ticket: "T-025" }), context(), "another ticket's evidence");
  });

  it("when a finding is still open", () => {
    const open = findings({
      rounds: [
        {
          round: 1,
          at: "2026-09-09T12:00:00.000Z",
          commit: "abc1234",
          findings: [{ ...finding, disposition: undefined, evidence: undefined }],
        },
      ],
    });

    notDone(green, open, context(), "undisposed");
  });

  it("when a disposition is missing its evidence", () => {
    const unevidenced = findings({
      rounds: [
        {
          round: 1,
          at: "2026-09-09T12:00:00.000Z",
          commit: "abc1234",
          findings: [{ ...finding, evidence: undefined }],
        },
      ],
    });

    notDone(green, unevidenced, context(), "needs evidence");
  });

  it("when the ledger had a line it could not read", () => {
    notDone(green, findings(), context({ damaged: 1 }), "unreadable line");
  });
});

describe("what the report ignores", () => {
  it("a red check the diff does not route", () => {
    // Run by hand with `--only`, against a database deliberately pointed at an
    // unmigrated schema. It is not this change's business, and letting it block
    // would mean a stray experiment wedges the loop with no way back.
    const rows = [...green, row("verify-schema", "fail")];

    expect(loopReport(rows, findings(), context()).done).toBe(true);
  });

  it("rows belonging to an older tree", () => {
    const rows = [row("test", "fail", { tree: "0000000" }), ...green];

    expect(loopReport(rows, findings(), context()).done).toBe(true);
  });
});
