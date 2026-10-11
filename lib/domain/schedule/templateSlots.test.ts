import { describe, expect, it } from "vitest";
import type { TemplateSlotInput } from "./types";
import { sameLesson } from "@/lib/validation/slotFields";
import {
  copyParity,
  otherParity,
  replaceDaySlots,
  saveDaySlots,
} from "./templateSlots";

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
      replaceDaySlots(before, { weekday: "MON", parity: "NUMERATOR" }, next, [1, 2]),
    ).toEqual([monDenominator1, tueNumerator1, ...next]);
  });

  it("leaves the same weekday in the other parity week alone", () => {
    // Two rows, one per parity — there is no "both weeks" slot (schema §4.8),
    // so editing the numerator Monday cannot reach the denominator Monday.
    const result = replaceDaySlots(
      before,
      { weekday: "MON", parity: "NUMERATOR" },
      [],
      [1, 2],
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
      [1, 2],
    );

    expect(result).not.toContainEqual(monNumerator2);
  });

  it("keeps a slot at a lesson number the form never showed", () => {
    // Another window added lesson 6 after this page rendered rows 1 and 2, or
    // the bell row for it was deleted since. An input that does not exist is
    // not the teacher clearing a cell, and deleting the slot would be a lesson
    // that silently stops existing.
    const late = slot("MON", 6, "NUMERATOR", "Факультатив");

    expect(
      replaceDaySlots(
        [...before, late],
        { weekday: "MON", parity: "NUMERATOR" },
        [],
        [1, 2],
      ),
    ).toContainEqual(late);
  });

  it("adds a day that had no slots at all", () => {
    const next = [slot("SAT", 1, "NUMERATOR", "Відпрацювання")];

    expect(
      replaceDaySlots(before, { weekday: "SAT", parity: "NUMERATOR" }, next, [1]),
    ).toEqual([...before, ...next]);
  });

  it("does not mutate the slots it was given", () => {
    const original = [...before];
    replaceDaySlots(before, { weekday: "MON", parity: "NUMERATOR" }, [], [1, 2]);

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

describe("saveDaySlots — «в обох тижнях» (T-043, ADR-025)", () => {
  const same = (a: TemplateSlotInput["payload"] | undefined, b: TemplateSlotInput["payload"] | undefined) =>
    sameLesson("OWN", a, b);
  const sorted = (slots: readonly TemplateSlotInput[]) =>
    [...slots].sort(
      (a, b) =>
        a.weekday.localeCompare(b.weekday) ||
        a.parity.localeCompare(b.parity) ||
        a.lessonNumber - b.lessonNumber,
    );

  // ADR-025's context: Monday filled once for both weeks (step 1), then two
  // lessons changed in the denominator week only (step 2).
  const numerator = [
    slot("MON", 1, "NUMERATOR", "Математика"),
    slot("MON", 2, "NUMERATOR", "Фізика"),
    slot("MON", 3, "NUMERATOR", "Історія"),
  ];
  const denominator = [
    slot("MON", 1, "DENOMINATOR", "Математика"),
    slot("MON", 2, "DENOMINATOR", "Хімія"),
    slot("MON", 3, "DENOMINATOR", "Біологія"),
  ];
  const tuesday = slot("TUE", 1, "NUMERATOR", "Історія");
  const before = [...numerator, ...denominator, tuesday];
  const monNumerator = { weekday: "MON", parity: "NUMERATOR" } as const;

  it("carries a lesson added with its toggle on into the other week, and keeps the rows that differ there", () => {
    // Step 3: a lesson added to the numerator Monday, meant for both weeks.
    const geography = slot("MON", 4, "NUMERATOR", "Географія");
    const result = saveDaySlots(
      before,
      monNumerator,
      [...numerator, geography],
      [1, 2, 3, 4],
      [4],
      same,
    );

    expect(sorted(result.slots)).toEqual(
      sorted([
        ...numerator,
        geography,
        ...denominator,
        slot("MON", 4, "DENOMINATOR", "Географія"),
        tuesday,
      ]),
    );
    expect(result.changedInOther).toEqual([4]);
  });

  it("removes an emptied row with its toggle on from both weeks", () => {
    const result = saveDaySlots(
      before,
      monNumerator,
      [numerator[0], numerator[2]],
      [1, 2, 3],
      [2],
      same,
    );

    expect(result.slots.filter((s) => s.weekday === "MON" && s.lessonNumber === 2)).toEqual([]);
    expect(result.slots).toContainEqual(denominator[2]);
    expect(result.changedInOther).toEqual([2]);
  });

  it("replaces a differing lesson in the other week and reports it", () => {
    const result = saveDaySlots(before, monNumerator, numerator, [1, 2, 3], [2, 3], same);

    expect(sorted(result.slots)).toEqual(
      sorted([
        ...numerator,
        denominator[0],
        slot("MON", 2, "DENOMINATOR", "Фізика"),
        slot("MON", 3, "DENOMINATOR", "Історія"),
        tuesday,
      ]),
    );
    expect(result.changedInOther).toEqual([2, 3]);
  });

  it("does not report a row switched on that was already equal in both weeks", () => {
    const result = saveDaySlots(before, monNumerator, numerator, [1, 2, 3], [1], same);

    expect(sorted(result.slots)).toEqual(sorted(before));
    expect(result.changedInOther).toEqual([]);
  });

  it("writes only the week on the screen when every toggle is off", () => {
    const algebra = slot("MON", 1, "NUMERATOR", "Алгебра");
    const result = saveDaySlots(
      before,
      monNumerator,
      [algebra, numerator[1], numerator[2]],
      [1, 2, 3],
      [],
      same,
    );

    expect(result.slots).toEqual(
      replaceDaySlots(before, monNumerator, [algebra, numerator[1], numerator[2]], [1, 2, 3]),
    );
    expect(result.changedInOther).toEqual([]);
  });

  it("leaves other weekdays untouched and returns one slot set for one version", () => {
    const result = saveDaySlots(before, monNumerator, [], [1, 2, 3], [1, 2, 3], same);

    expect(result.slots).toEqual([tuesday]);
    expect(result.changedInOther).toEqual([1, 2, 3]);
  });

  it("ignores a toggle on a lesson number the form did not render", () => {
    const stray = slot("MON", 7, "DENOMINATOR", "Музика");
    const result = saveDaySlots([...before, stray], monNumerator, numerator, [1, 2, 3], [7], same);

    expect(result.slots).toContainEqual(stray);
    expect(result.changedInOther).toEqual([]);
  });

  it("after «Скопіювати з чисельника», an edit with the toggles off stays in the week on the screen", () => {
    // Specification §5.1: copy, then edit the cells that differ. The toggles
    // open off, so the edit is a one-week edit and the numerator is unchanged.
    const copied = copyParity(before, "NUMERATOR", "DENOMINATOR");
    const chemistry = slot("MON", 2, "DENOMINATOR", "Хімія");
    const copiedDenominator = copied.filter(
      (s) => s.weekday === "MON" && s.parity === "DENOMINATOR",
    );
    const next = copiedDenominator.map((s) => (s.lessonNumber === 2 ? chemistry : s));

    const result = saveDaySlots(
      copied,
      { weekday: "MON", parity: "DENOMINATOR" },
      next,
      [1, 2, 3],
      [],
      same,
    );

    expect(result.slots.filter((s) => s.parity === "NUMERATOR")).toEqual(
      copied.filter((s) => s.parity === "NUMERATOR"),
    );
    expect(result.slots).toContainEqual(chemistry);
    expect(result.changedInOther).toEqual([]);
  });

  it("names the other parity week", () => {
    expect(otherParity("NUMERATOR")).toBe("DENOMINATOR");
    expect(otherParity("DENOMINATOR")).toBe("NUMERATOR");
  });
});
