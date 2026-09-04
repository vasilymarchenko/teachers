import { describe, expect, it } from "vitest";
import type { TemplateSlotInput } from "./types";
import { copyParity, replaceDaySlots } from "./templateSlots";

/**
 * The slot-set transforms of T-010. Expectations come from specification §5.1
 * and schema §4.8, not from running the functions.
 */

const slot = (
  weekday: TemplateSlotInput["weekday"],
  lessonNumber: number,
  parity: TemplateSlotInput["parity"],
  subject: string,
): TemplateSlotInput => ({
  weekday,
  lessonNumber,
  parity,
  payload: { subject, className: "7-А" },
});

const monNumerator1 = slot("MON", 1, "NUMERATOR", "Математика");
const monNumerator2 = slot("MON", 2, "NUMERATOR", "Українська мова");
const monDenominator1 = slot("MON", 1, "DENOMINATOR", "Геометрія");
const tueNumerator1 = slot("TUE", 1, "NUMERATOR", "Історія");

describe("replaceDaySlots", () => {
  const before = [
    monNumerator1,
    monNumerator2,
    monDenominator1,
    tueNumerator1,
  ];

  it("replaces the submitted day of the submitted parity", () => {
    const next = [slot("MON", 1, "NUMERATOR", "Алгебра")];

    expect(
      replaceDaySlots(before, { weekday: "MON", parity: "NUMERATOR" }, next),
    ).toEqual([monDenominator1, tueNumerator1, ...next]);
  });

  it("leaves the same weekday in the other parity week alone", () => {
    // Two rows, one per parity — there is no "both weeks" slot (schema §4.8),
    // so editing the numerator Monday cannot reach the denominator Monday.
    const result = replaceDaySlots(
      before,
      { weekday: "MON", parity: "NUMERATOR" },
      [],
    );

    expect(result).toContainEqual(monDenominator1);
    expect(result).toEqual([monDenominator1, tueNumerator1]);
  });

  it("removes a lesson the form did not submit back", () => {
    // A cleared cell is a slot that is absent from `next`: «a slot is present
    // only when the cell is filled» (schema §4.8).
    const result = replaceDaySlots(
      before,
      { weekday: "MON", parity: "NUMERATOR" },
      [monNumerator1],
    );

    expect(result).not.toContainEqual(monNumerator2);
  });

  it("adds a day that had no slots at all", () => {
    const next = [slot("SAT", 1, "NUMERATOR", "Відпрацювання")];

    expect(
      replaceDaySlots(before, { weekday: "SAT", parity: "NUMERATOR" }, next),
    ).toEqual([...before, ...next]);
  });

  it("does not mutate the slots it was given", () => {
    const original = [...before];
    replaceDaySlots(before, { weekday: "MON", parity: "NUMERATOR" }, []);

    expect(before).toEqual(original);
  });
});

describe("copyParity", () => {
  const before = [monNumerator1, monNumerator2, monDenominator1];

  it("writes the source week over the target week", () => {
    expect(copyParity(before, "NUMERATOR", "DENOMINATOR")).toEqual([
      monNumerator1,
      monNumerator2,
      { ...monNumerator1, parity: "DENOMINATOR" },
      { ...monNumerator2, parity: "DENOMINATOR" },
    ]);
  });

  it("drops a target lesson that the source does not have", () => {
    // «Скопіювати» replaces the week; merging would leave a lesson the teacher
    // can no longer see the origin of.
    const result = copyParity([monNumerator1, monDenominator1], "NUMERATOR", "DENOMINATOR");

    expect(result).not.toContainEqual(monDenominator1);
  });

  it("copies in the other direction too", () => {
    expect(copyParity(before, "DENOMINATOR", "NUMERATOR")).toEqual([
      monDenominator1,
      { ...monDenominator1, parity: "NUMERATOR" },
    ]);
  });

  it("leaves the set alone when the two parities are the same", () => {
    expect(copyParity(before, "NUMERATOR", "NUMERATOR")).toEqual(before);
  });

  it("does not mutate the slots it was given", () => {
    const original = structuredClone(before);
    copyParity(before, "NUMERATOR", "DENOMINATOR");

    expect(before).toEqual(original);
  });
});
