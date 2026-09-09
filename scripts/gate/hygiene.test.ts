import { describe, expect, it } from "vitest";

import { addedLines, hygieneProblems } from "./hygiene";

/**
 * Diff hygiene: the four things that arrive in a diff without anyone choosing
 * them. Each is checked against *added* lines only — a `.skip` that was already
 * there is somebody else's decision, and reporting it would make the check
 * fire on every diff that touches the file.
 */

const clean = { changedPaths: [], diff: "", status: "" };

const diffOf = (file: string, ...lines: string[]) =>
  [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, ...lines].join(
    "\n",
  );

describe("added lines", () => {
  it("are the + lines, without the marker, tagged with their file", () => {
    const diff = diffOf("lib/a.test.ts", "@@ -1 +1,2 @@", " kept", "+added", "-removed");

    expect(addedLines(diff)).toEqual([{ file: "lib/a.test.ts", line: "added" }]);
  });

  it("do not include the +++ header of the next file", () => {
    // Without this the file header reads as content, and every diff of two or
    // more files reports a line nobody wrote.
    const diff = [diffOf("a.ts", "+one"), diffOf("b.ts", "+two")].join("\n");

    expect(addedLines(diff)).toEqual([
      { file: "a.ts", line: "one" },
      { file: "b.ts", line: "two" },
    ]);
  });
});

describe("a focused or disabled test", () => {
  it("is a finding when the diff adds it", () => {
    expect(
      hygieneProblems({
        ...clean,
        diff: diffOf("lib/domain/expand.test.ts", "+  it.only(\"does a thing\", () => {"),
      }),
    ).toEqual([
      "lib/domain/expand.test.ts: a focused test (`.only`) — the suite would run only that",
    ]);
  });

  it("catches describe.skip and it.todo as well", () => {
    const problems = hygieneProblems({
      ...clean,
      diff: diffOf("lib/a.test.ts", "+describe.skip(\"x\", () => {", "+  it.todo(\"y\");"),
    });

    expect(problems).toHaveLength(2);
  });

  it("is not a finding when the line was only moved past, not added", () => {
    expect(
      hygieneProblems({
        ...clean,
        diff: diffOf("lib/a.test.ts", " it.skip(\"already here\", () => {"),
      }),
    ).toEqual([]);
  });

  it("is not a finding when the call is quoted inside a string", () => {
    // The check reported four defects in this very file the first time it ran:
    // the fixtures above pass `it.only(...)` as literal diff text, and an
    // unanchored pattern cannot tell that from a focused test. A focused test
    // starts its line; a quoted one does not.
    expect(
      hygieneProblems({
        ...clean,
        diff: diffOf("lib/a.test.ts", '+        diff: diffOf("x.test.ts", "+  it.only(y)"),'),
      }),
    ).toEqual([]);
  });

  it("still fires on one the line merely indents or awaits", () => {
    const problems = hygieneProblems({
      ...clean,
      diff: diffOf("lib/a.test.ts", '+    it.only("indented", () => {}); '),
    });

    expect(problems).toHaveLength(1);
  });

  it("is not a finding outside a test file", () => {
    // `.only` is an ordinary identifier in application code — a Zod refinement,
    // a query builder — and reporting it there is how a check starts producing
    // confident nonsense.
    expect(
      hygieneProblems({ ...clean, diff: diffOf("lib/db/queries/day.ts", "+  it.only(x)") }),
    ).toEqual([]);
  });
});

describe("an env file", () => {
  it("is a finding in the changed set", () => {
    expect(hygieneProblems({ ...clean, changedPaths: [".env"] })).toEqual([
      ".env: an env file in the diff — .env.example is the only one that is committed",
    ]);
  });

  it("catches .env.local and .env.production too", () => {
    expect(
      hygieneProblems({ ...clean, changedPaths: [".env.local", ".env.production"] }),
    ).toHaveLength(2);
  });

  it("leaves .env.example alone", () => {
    expect(hygieneProblems({ ...clean, changedPaths: [".env.example"] })).toEqual([]);
  });
});

describe("the block next dev re-adds to CLAUDE.md", () => {
  it("is a finding while it sits uncommitted", () => {
    expect(hygieneProblems({ ...clean, status: " M CLAUDE.md" })).toHaveLength(1);
  });

  it("is not a finding once it is committed with the work", () => {
    expect(
      hygieneProblems({ ...clean, changedPaths: ["CLAUDE.md"], status: "" }),
    ).toEqual([]);
  });

  it("does not fire on another CLAUDE.md", () => {
    // `docs/backlog/CLAUDE.md` is a conventions file; `next dev` does not touch
    // it, and an ordinary uncommitted edit to it is not a stray change.
    expect(hygieneProblems({ ...clean, status: " M docs/backlog/CLAUDE.md" })).toEqual([]);
  });
});

it("says nothing about a clean diff", () => {
  expect(
    hygieneProblems({
      changedPaths: ["lib/domain/schedule/expand.ts"],
      diff: diffOf("lib/domain/schedule/expand.ts", "+export function expand() {}"),
      status: "",
    }),
  ).toEqual([]);
});
