import { describe, expect, it } from "vitest";
import {
  boundaryKindEnum,
  nonTeachingKindEnum,
  parityEnum,
  weekdayEnum,
} from "@/lib/db/schema/enums";
import {
  BOUNDARY_KIND_VALUES,
  LESSON_NUMBERS,
  NON_TEACHING_KIND_VALUES,
  PARITY_VALUES,
  SEMESTER_INDEXES,
  WEEKDAY_VALUES,
} from "./enums";

/**
 * The transcription in `enums.ts` against the database enums it mirrors.
 *
 * Without this the two could drift silently in the direction that matters: a
 * value added to a `pgEnum` in a migration and never offered by a form is a
 * `kind` the teacher cannot choose, with nothing failing anywhere. Order is
 * asserted too — it is the order the options appear in the form.
 */

describe("the form enum tuples", () => {
  const cases = [
    ["parity", PARITY_VALUES, parityEnum],
    ["weekday", WEEKDAY_VALUES, weekdayEnum],
    ["non_teaching_kind", NON_TEACHING_KIND_VALUES, nonTeachingKindEnum],
    ["boundary_kind", BOUNDARY_KIND_VALUES, boundaryKindEnum],
  ] as const;

  for (const [name, values, pgEnum] of cases) {
    it(`${name} matches the database enum, in order`, () => {
      expect([...values]).toStrictEqual([...pgEnum.enumValues]);
    });
  }
});

describe("the numeric ranges", () => {
  it("covers lesson numbers 0 to 9", () => {
    // Specification §3.3 and the `bell_schedule_number_ck` constraint.
    expect([...LESSON_NUMBERS]).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("offers the two semesters of the year and no third", () => {
    // Specification §3.2: «Поняття чвертей у програмі немає».
    expect([...SEMESTER_INDEXES]).toStrictEqual([1, 2]);
  });
});
