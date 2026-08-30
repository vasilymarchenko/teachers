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
    // Backticked tokens that look like a path: they contain a slash, they are
    // not absolute (`/print` is a route, not a file), and they carry no glob
    // (`docs/backlog/**` names a rule's scope, not a file).
    const paths = [...rubric.matchAll(/`([\w.@-][\w./@-]*)`/g)]
      .map((m) => m[1])
      .filter((token) => token.includes("/") && !token.startsWith("/"));
    expect(paths.length).toBeGreaterThan(0);

    const missing = [...new Set(paths)].filter((p) => !existsSync(p));
    expect(missing, `paths cited by ${RUBRIC} that do not exist`).toEqual([]);
  });
});
