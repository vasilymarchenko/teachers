import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CAPS } from "./caps";

/**
 * Both skills run the gate, and neither restates a cap number (T-029).
 *
 * The second half is the one worth enforcing mechanically: a number written
 * into prose is a number that goes on being right until `caps.ts` changes,
 * after which nothing says it is wrong. A path cannot drift the same way — it
 * either resolves or it does not.
 */

const SKILLS = [
  ".claude/skills/teachers-ticket/SKILL.md",
  ".claude/skills/teachers-review/SKILL.md",
] as const;

const sources = SKILLS.map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

describe("the skills and the gate", () => {
  for (const { path, text } of sources) {
    it(`${path} runs the gate`, () => {
      expect(text).toContain("npm run gate");
    });

    it(`${path} points at the caps rather than repeating a number`, () => {
      expect(text).toContain("scripts/gate/caps.ts");
    });

    it(`${path} chains no checks of its own`, () => {
      // The shape the gate replaces: two npm commands joined so that the first
      // failure hides the rest. Matched as a command, not as the idea of one —
      // both files explain why chaining is wrong, and prose about a mistake
      // must not read as the mistake.
      expect(text.match(/npm (?:run [\w:-]+|test) *&& *npm/g)).toBeNull();
    });
  }

  it("has one module holding every cap", () => {
    // The shape, not the values: `caps.ts` is free to change a number, and a
    // golden-value assertion here would pin the code to the prose from the
    // other side — exactly the drift the module exists to prevent.
    expect(Object.keys(CAPS).sort()).toEqual([
      "gateRunsPerRound",
      "pushesAfterOpening",
      "reviewRounds",
    ]);
  });

  it("routes the review by a kind it reads from the code, not from a copy", () => {
    // T-037 gives the review a second dimension beside `--effort`, and the
    // classification is `changeKind()` in `scripts/gate/checks.ts` — the same
    // one the gate routes itself by, so one diff is one kind in both tools. A
    // path list transcribed into the skill is the copy that goes on being
    // right until the code changes; this asserts the pointer, the way the cap
    // assertion above asserts a path rather than a number.
    const review = sources.find((s) => s.path.includes("teachers-review"))!;
    expect(review.text).toContain("changeKind()");
    expect(review.text).toContain("scripts/gate/checks.ts");
  });

  // That neither skill *states a cap value* is not asserted mechanically, and
  // deliberately. A regex cannot tell a numeral naming a cap from an ordinal
  // naming one of them — "the second and third are the loops T-026 left open"
  // is correct prose that any such pattern flags. A check phrased more widely
  // than the rule it comes from is how a reviewer starts producing confident
  // nonsense; the two assertions above are the ones a pattern can carry.
});
