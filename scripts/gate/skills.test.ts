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

  it("has one module holding the caps, and all three are three", () => {
    // Not a golden-value test of the numbers themselves — `caps.ts` is free to
    // change them. It asserts the shape the skills' prose relies on: three
    // named caps, one module, and the "all of them three" the ticket states.
    expect(Object.keys(CAPS).sort()).toEqual([
      "gateRunsPerRound",
      "pushesAfterOpening",
      "reviewRounds",
    ]);
    expect([...new Set(Object.values(CAPS))]).toEqual([3]);
  });
});
