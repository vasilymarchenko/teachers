import { describe, expect, it } from "vitest";

import { porcelainPaths, treeId, untrackedPaths, wholeFileAsAdded } from "./git";

/**
 * The porcelain parser exists because the obvious thing — trim the output,
 * `slice(3)` each line — is wrong in a way that hides. Every case below is one
 * the first version got wrong or would have.
 */

describe("porcelain paths", () => {
  it("keeps the path when the first status column is a space", () => {
    // The bug this parser replaces: trimming the whole output ate the leading
    // space of the first line, and `slice(3)` then returned "EADME.md".
    expect(porcelainPaths(" M README.md\n?? .gate/\n")).toEqual([
      "README.md",
      ".gate/",
    ]);
  });

  it("reads staged, unstaged, added, deleted and untracked alike", () => {
    expect(
      porcelainPaths("M  a.ts\n M b.ts\nA  c.ts\n D d.ts\nMM e.ts\n?? f.ts"),
    ).toEqual(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"]);
  });

  it("takes the new name of a rename", () => {
    expect(porcelainPaths('R  old.ts -> new.ts')).toEqual(["new.ts"]);
  });

  it("strips the quotes git adds to an awkward path", () => {
    expect(porcelainPaths(' M "docs/a b.md"')).toEqual(["docs/a b.md"]);
  });

  it("ignores blank lines rather than yielding an empty path", () => {
    expect(porcelainPaths("\n M a.ts\n\n")).toEqual(["a.ts"]);
  });
});

describe("untracked paths", () => {
  it("are the ?? lines only", () => {
    expect(untrackedPaths(" M a.ts\n?? b.test.ts\nA  c.ts")).toEqual(["b.test.ts"]);
  });
});

describe("the tree identity", () => {
  it("is the commit alone when the tree is clean", () => {
    expect(treeId("abc1234", "", "")).toBe("abc1234");
    expect(treeId("abc1234", "\n", "")).toBe("abc1234");
  });

  it("is the commit plus a digest when it is not", () => {
    const dirty = treeId("abc1234", " M a.ts", "+one");

    expect(dirty).toMatch(/^abc1234\+[0-9a-f]{8}$/);
  });

  it("changes when the working tree changes, so an edit resets the attempt count", () => {
    expect(treeId("abc1234", " M a.ts", "+one")).not.toBe(
      treeId("abc1234", " M a.ts", "+two"),
    );
  });

  it("is stable for the same tree, so re-running an unchanged tree is visibly a re-run", () => {
    expect(treeId("abc1234", " M a.ts", "+one")).toBe(
      treeId("abc1234", " M a.ts", "+one"),
    );
  });

  it("changes when the content of an untracked file changes", () => {
    // Porcelain names an untracked file without describing it, so without the
    // extra part, deleting an it.only from a new test leaves the identity
    // unchanged: the now-passing check is recorded as a flake owing a ticket
    // for a defect that was simply fixed.
    const status = "?? lib/a.test.ts";

    expect(treeId("abc1234", status, "", ["lib/a.test.ts it.only(x)"])).not.toBe(
      treeId("abc1234", status, "", ["lib/a.test.ts it(x)"]),
    );
  });

  it("is not the bare commit when only untracked content is in play", () => {
    expect(treeId("abc1234", "", "", ["new file"])).not.toBe("abc1234");
  });

  it("does not confuse a status and a diff that concatenate the same way", () => {
    // Without a separator between the two, ("ab", "c") and ("a", "bc") hash
    // alike, and two different trees would share an identity.
    expect(treeId("abc1234", " M ab", "c")).not.toBe(treeId("abc1234", " M a", "bc"));
  });
});

describe("an untracked file presented as a diff", () => {
  it("makes every line an added line under the file's own header", () => {
    expect(wholeFileAsAdded("lib/a.test.ts", 'it.only("x", () => {});')).toBe(
      '--- /dev/null\n+++ b/lib/a.test.ts\n+it.only("x", () => {});\n',
    );
  });
});
