import { describe, expect, it } from "vitest";
import { weekdayRuleInput } from "./weekdayRule";

/**
 * Specification §3.4 as the form's boundary — the symbolic half of overview
 * §8.1.
 *
 * What the form must get right is which fields belong together: «до дати Х»
 * needs a date and the other two kinds must not, and no kind carries a
 * `validFrom` (that one is not the teacher's to choose — ADR-004).
 */

const issuesOf = (input: unknown) => {
  const parsed = weekdayRuleInput.safeParse(input);
  return parsed.success ? [] : parsed.error.issues;
};

describe("weekdayRuleInput", () => {
  it("accepts the fixture's methodical day, bounded by the next break", () => {
    // Fixtures §3.3 — R1: Friday, «до найближчих канікул».
    expect(
      weekdayRuleInput.parse({
        weekday: "FRI",
        boundaryKind: "NEXT_BREAK",
        lastDay: "",
      }),
    ).toStrictEqual({
      weekday: "FRI",
      boundaryKind: "NEXT_BREAK",
      lastDay: undefined,
    });
  });

  it("accepts a rule bounded by an explicit last day", () => {
    // Fixtures §3.3 — R2/R3, the weekend, «до дати Х» = the year's last day.
    expect(
      weekdayRuleInput.parse({
        weekday: "SAT",
        boundaryKind: "DATE",
        lastDay: "2027-05-31",
      }).lastDay,
    ).toBe("2027-05-31");
  });

  it("accepts a rule bounded by the end of the semester", () => {
    expect(
      weekdayRuleInput.safeParse({
        weekday: "WED",
        boundaryKind: "END_OF_SEMESTER",
        lastDay: "",
      }).success,
    ).toBe(true);
  });

  it("refuses «до дати Х» without a date", () => {
    const issues = issuesOf({ weekday: "FRI", boundaryKind: "DATE", lastDay: "" });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toStrictEqual(["lastDay"]);
    expect(issues[0].message).toBe("Виберіть останній день, коли правило ще діє");
  });

  it("keeps a stray date on a symbolic kind rather than failing", () => {
    // Switching the select from «до дати Х» back to «до канікул» leaves the
    // date input filled. The action resolves from the kind and ignores it; a
    // rejection here would make the form unusable for the sake of tidiness.
    expect(
      weekdayRuleInput.safeParse({
        weekday: "FRI",
        boundaryKind: "NEXT_BREAK",
        lastDay: "2026-12-01",
      }).success,
    ).toBe(true);
  });

  it("rejects a weekday the database does not have", () => {
    expect(issuesOf({ weekday: "MONDAY", boundaryKind: "NEXT_BREAK", lastDay: "" })[0].message).toBe(
      "Оберіть день тижня",
    );
  });

  it("rejects a boundary kind the database does not have", () => {
    expect(issuesOf({ weekday: "FRI", boundaryKind: "FOREVER", lastDay: "" })[0].message).toBe(
      "Оберіть, доки діє правило",
    );
  });

  it("rejects a malformed last day", () => {
    expect(issuesOf({ weekday: "FRI", boundaryKind: "DATE", lastDay: "31.05.2027" })[0].path).toStrictEqual(
      ["lastDay"],
    );
  });
});
