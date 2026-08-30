import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The rubric is a list of `§` references and repository paths — that is the
 * whole design: it asks a question and points at the document that answers it,
 * so the reasoning stays in one place (T-017). The failure mode that design
 * has is rot. A section renumbered in `architect-overview.md`, or a file moved
 * under `lib/`, turns a check into a pointer at nothing, and nothing about the
 * rubric's own text says so.
 *
 * These tests are the cheap half of `docs/architecture/design/`-style
 * discipline applied to tooling: they cannot tell whether a check is *right*,
 * only whether what it cites still exists.
 */

const RUBRIC = ".claude/skills/review/references/rubric.md";
const OVERVIEW = "docs/architecture/architect-overview.md";

const rubric = readFileSync(RUBRIC, "utf8");

describe("review rubric references", () => {
  it("cites only sections that exist in architect-overview.md", () => {
    // The rubric declares that a bare `§N` means the overview; its own
    // structure is lettered (`§A`…`§F`) precisely so the two never collide.
    const cited = [...rubric.matchAll(/§(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
    expect(cited.length).toBeGreaterThan(0);

    const overview = readFileSync(OVERVIEW, "utf8");
    // `## 9. Компроміси` carries a dot after the number, `### 9.1 Парність`
    // does not — both forms are headings the rubric may cite.
    const headings = new Set(
      [...overview.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.?\s/gm)].map((m) => m[1]),
    );

    const missing = [...new Set(cited)].filter((s) => !headings.has(s));
    expect(missing, `sections cited by ${RUBRIC} but absent from ${OVERVIEW}`)
      .toEqual([]);
  });

  it("cites only repository paths that exist", () => {
    // A slash alone does not make a token a path: `NUMERATOR/DENOMINATOR` is a
    // domain term, and the rubric is full of those. Anchoring on the
    // repository's top-level directories keeps a renamed term from failing an
    // unrelated PR, at the cost of not checking a path outside them — of which
    // there are none, because there is nowhere else to cite.
    const ROOTS = ["lib/", "app/", "docs/", "components/", ".claude/", "drizzle/"];
    const paths = [...rubric.matchAll(/`([\w.@-][\w./@-]*)`/g)]
      .map((m) => m[1])
      .filter((token) => ROOTS.some((root) => token.startsWith(root)));
    expect(paths.length).toBeGreaterThan(0);

    const missing = [...new Set(paths)].filter((p) => !existsSync(p));
    expect(missing, `paths cited by ${RUBRIC} that do not exist`).toEqual([]);
  });

  it("names a cited test file by its full path, so the check above sees it", () => {
    // The filter above only sees tokens under a known directory, which leaves a
    // hole: a bare `nav-items.test.ts` is checked by nothing and can name a
    // file that has moved or never existed. Citing a test file at all is rare
    // and always deliberate — §F cites two as the precedent to follow — so
    // requiring the directory costs nothing and closes the hole.
    const bare = [...rubric.matchAll(/`([\w.-]+\.test\.tsx?)`/g)].map(
      (m) => m[1],
    );
    expect(bare, `test files cited by ${RUBRIC} without a directory`).toEqual(
      [],
    );
  });
});
