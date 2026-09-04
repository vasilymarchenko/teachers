import { describe, expect, it } from "vitest";
import {
  boundaryKindEnum,
  nonTeachingKindEnum,
  parityEnum,
  weekdayEnum,
} from "@/lib/db/schema/enums";
import {
  BOUNDARY_KIND_LABELS,
  BOUNDARY_KIND_OPTIONS,
  NON_TEACHING_KIND_LABELS,
  NON_TEACHING_KIND_OPTIONS,
  PARITY_OPTION_LABELS,
  PARITY_OPTIONS,
  SEMESTERS_SECTION,
  WEEKDAY_LABELS,
  WEEKDAY_OPTIONS,
} from "./labels";

/**
 * Every value the teacher can be shown has a Ukrainian word for it.
 *
 * The screens render these as `<select>` options, so a missing entry is not a
 * crash: it is an empty option the teacher cannot tell apart from the next one.
 * The suite has no DOM (`vitest.config.mts`), so this is what stands in for
 * rendering the forms — the same trade the navigation's tests make (T-014).
 */

const cases = [
  ["parity", parityEnum, PARITY_OPTION_LABELS, PARITY_OPTIONS],
  ["weekday", weekdayEnum, WEEKDAY_LABELS, WEEKDAY_OPTIONS],
  ["non_teaching_kind", nonTeachingKindEnum, NON_TEACHING_KIND_LABELS, NON_TEACHING_KIND_OPTIONS],
  ["boundary_kind", boundaryKindEnum, BOUNDARY_KIND_LABELS, BOUNDARY_KIND_OPTIONS],
] as const;

describe("the year-setup labels", () => {
  for (const [name, pgEnum, labels, options] of cases) {
    it(`names every ${name} value`, () => {
      for (const value of pgEnum.enumValues) {
        const label = (labels as Record<string, string>)[value];
        expect(label, `${name}.${value}`).toBeTruthy();
      }
    });

    it(`offers every ${name} value as an option, in the database's order`, () => {
      expect(options.map((option) => option.value)).toStrictEqual([
        ...pgEnum.enumValues,
      ]);
    });

    it(`labels every ${name} option with its own word`, () => {
      for (const option of options) {
        expect(option.label).toBe((labels as Record<string, string>)[option.value]);
      }
    });
  }
});

describe("the labels that are not enum values", () => {
  it("names both semesters", () => {
    // Specification §3.2 — two, and never a third.
    expect(SEMESTERS_SECTION.option(1)).toBe("Перший");
    expect(SEMESTERS_SECTION.option(2)).toBe("Другий");
  });
});
