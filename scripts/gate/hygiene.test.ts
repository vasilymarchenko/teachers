import { describe, expect, it } from "vitest";

import { hygieneProblems, NEXT_DEV_BLOCK, type HygieneInput } from "./hygiene";

/**
 * Diff hygiene (T-029): the three things worth catching before a reviewer's
 * attention is spent on them.
 *
 * Every case is a string, never this repository's own tree — a test that
 * asserted against the real `CLAUDE.md` would go green or red for reasons that
 * have nothing to do with the check.
 */

const input = (over: Partial<HygieneInput> = {}): HygieneInput => ({
  changedFiles: [],
  contents: new Map(),
  claudeMd: `# CLAUDE.md\n\n${NEXT_DEV_BLOCK}\n`,
  claudeMdAtHead: `# CLAUDE.md\n\n${NEXT_DEV_BLOCK}\n`,
  ...over,
});

const withFile = (path: string, source: string, over: Partial<HygieneInput> = {}) =>
  input({ changedFiles: [path], contents: new Map([[path, source]]), ...over });

describe("a focused test", () => {
  // Built at run time rather than written as a literal: this file is a test
  // *about* the check, and a literal here would be a finding against itself.
  const focused = (form: string) => `${form}.only("a case", () => {});\n`;

  it.each(["describe", "it", "test"])("catches %s", (form) => {
    expect(
      hygieneProblems(withFile("lib/domain/x.test.ts", focused(form))),
    ).toEqual(["lib/domain/x.test.ts: a focused .only test would silence the suite"]);
  });

  it("catches one indented among other cases", () => {
    expect(
      hygieneProblems(
        withFile(
          "lib/domain/x.test.ts",
          `it("first", () => {});\n  ${focused("it")}`,
        ),
      ),
    ).toHaveLength(1);
  });

  it("leaves alone the things that merely look like one", () => {
    // A quoted mention, a comment, and a method on something else. Confident
    // nonsense from a check phrased more widely than the rule it comes from is
    // exactly what this repository's other convention tests guard against.
    expect(
      hygieneProblems(
        withFile(
          "lib/domain/x.test.ts",
          '// the only case that matters\nconst forms = ["it.only(", "test.only("];\n',
        ),
      ),
    ).toEqual([]);
    expect(hygieneProblems(withFile("lib/x.ts", "queue.only(1)"))).toEqual([]);
  });
});

describe("an environment file", () => {
  it("is a finding wherever it sits in the tree", () => {
    expect(hygieneProblems(input({ changedFiles: [".env"] }))).toEqual([
      ".env: an environment file must not be in the diff",
    ]);
    expect(hygieneProblems(input({ changedFiles: ["apps/web/.env.local"] }))).toHaveLength(1);
  });

  it("is not `.env.example`, which is committed and must be", () => {
    expect(hygieneProblems(input({ changedFiles: [".env.example"] }))).toEqual([]);
  });
});

describe("the block `next dev` maintains in CLAUDE.md", () => {
  const withBlock = `# CLAUDE.md\n\n${NEXT_DEV_BLOCK}\n`;
  const withoutBlock = "# CLAUDE.md\n";

  it("is clean when the tree and the commit both carry it", () => {
    expect(
      hygieneProblems(input({ claudeMd: withBlock, claudeMdAtHead: withBlock })),
    ).toEqual([]);
  });

  it("is a finding when the change dropped it", () => {
    expect(hygieneProblems(input({ claudeMd: withoutBlock }))).toEqual([
      "CLAUDE.md: the block `next dev` maintains was removed; it will come back",
    ]);
  });

  it("is a finding when `next dev` re-added it and nothing committed it", () => {
    expect(
      hygieneProblems(
        input({ claudeMd: withBlock, claudeMdAtHead: withoutBlock }),
      ).join(),
    ).toMatch(/is not committed/);
  });

  it("says nothing about an ordinary in-progress edit to CLAUDE.md", () => {
    // The gate runs before a fix is committed, so "CLAUDE.md is dirty" is not
    // the rule — "the block exists only as an uncommitted change" is.
    expect(
      hygieneProblems(
        input({
          changedFiles: ["CLAUDE.md"],
          claudeMd: `${withBlock}\nA paragraph being written right now.\n`,
          claudeMdAtHead: withBlock,
        }),
      ),
    ).toEqual([]);
  });

  it("says nothing when CLAUDE.md cannot be read at all", () => {
    expect(
      hygieneProblems(input({ claudeMd: null, claudeMdAtHead: null })),
    ).toEqual([]);
  });
});

describe("a clean diff", () => {
  it("produces no problems at all", () => {
    expect(
      hygieneProblems(
        input({
          changedFiles: ["lib/domain/x.ts", "lib/domain/x.test.ts", ".env.example"],
          contents: new Map([
            ["lib/domain/x.ts", "export const x = 1;\n"],
            ["lib/domain/x.test.ts", 'it("works", () => {});\n'],
          ]),
        }),
      ),
    ).toEqual([]);
  });
});
