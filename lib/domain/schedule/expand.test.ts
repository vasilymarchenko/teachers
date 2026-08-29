import { describe, expect, it } from "vitest";
import { expand } from "./expand";
import { EXPECTED_CLASS, EXPECTED_OWN } from "./fixtures/expected";
import { FIXTURE, WINDOW } from "./fixtures/scenario";
import type { ResolvedDay } from "./types";

/**
 * `docs/architecture/design/expand-fixtures.md` §6 and §7, date by date. The
 * expectations live in `fixtures/expected.ts` and were transcribed from those
 * tables; none of them was read off this implementation.
 *
 * `toStrictEqual` and not `toEqual`: §8.8 turns on `replacedOriginal` being
 * *absent* rather than `undefined`, and `toEqual` cannot tell the two apart.
 */

const ownDays = expand(FIXTURE, { ...WINDOW, view: "OWN" });
const classDays = expand(FIXTURE, { ...WINDOW, view: "CLASS" });

const on = (days: ResolvedDay[], date: string): ResolvedDay | undefined =>
  days.find((day) => day.date === date);

describe("expand(), OWN view", () => {
  it("returns one entry per date of the window, in order", () => {
    expect(ownDays).toHaveLength(33);
    expect(ownDays.map((day) => day.date)).toStrictEqual(
      EXPECTED_OWN.map((day) => day.date),
    );
  });

  it.each(EXPECTED_OWN.map((day) => [day.date, day] as const))(
    "%s",
    (date, expected) => {
      expect(on(ownDays, date)).toStrictEqual(expected);
    },
  );
});

describe("expand(), CLASS view", () => {
  it("returns the same 33 dates as the OWN view", () => {
    expect(classDays.map((day) => day.date)).toStrictEqual(
      ownDays.map((day) => day.date),
    );
    // Without this the `it.each` below would silently run fewer cases if a row
    // of §7 went missing from the transcription.
    expect(EXPECTED_CLASS.map((day) => day.date)).toStrictEqual(
      classDays.map((day) => day.date),
    );
  });

  it("marks every lesson with isTaughtByMe", () => {
    const lessons = classDays.flatMap((day) => day.lessons);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((lesson) => "isTaughtByMe" in lesson)).toBe(true);
  });

  it("leaves isTaughtByMe off every OWN lesson", () => {
    const lessons = ownDays.flatMap((day) => day.lessons);
    expect(lessons.some((lesson) => "isTaughtByMe" in lesson)).toBe(false);
  });

  it.each(EXPECTED_CLASS.map((day) => [day.date, day] as const))(
    "%s",
    (date, expected) => {
      expect(on(classDays, date)).toStrictEqual(expected);
    },
  );
});

/**
 * The dates fixtures §10 asks for by name: each one is a rule that a
 * plausible-looking implementation gets wrong, and each fails alone.
 */
describe("the dates that pin a rule of their own", () => {
  // Four different routes reach `lessons: []`, and only the first is non-teaching.
  it("2026-10-16 — empty because a weekday rule is in force", () => {
    expect(on(ownDays, "2026-10-16")).toStrictEqual({
      date: "2026-10-16",
      parity: "NUMERATOR",
      isNonTeaching: true,
      lessons: [],
    });
  });

  it("2026-10-19 — empty because a CLEARED tombstone gagged the slot", () => {
    const day = on(ownDays, "2026-10-19");
    expect(day?.lessons).toStrictEqual([]);
    // Not the same thing as 2026-10-16, however alike they render.
    expect(day?.isNonTeaching).toBe(false);
  });

  it("2026-10-21 — empty because no CLASS version covers the date", () => {
    expect(on(classDays, "2026-10-21")).toStrictEqual({
      date: "2026-10-21",
      parity: "DENOMINATOR",
      isNonTeaching: false,
      lessons: [],
    });
    // Neither neighbour leaks into the gap: CLASS-V1 has a Wednesday slot and
    // CLASS-V2 has one too, and this date shows neither.
    expect(on(ownDays, "2026-10-21")?.lessons).toHaveLength(2);
  });

  it("2026-11-03 — empty because OWN-V2 has no TUE/DENOMINATOR slot", () => {
    const day = on(ownDays, "2026-11-03");
    expect(day?.isNonTeaching).toBe(false);
    expect(day?.lessons).toStrictEqual([]);
  });

  // §8.4: the version and the parity in force on the rendered date, never the
  // ones in force when the substitution was written.
  it("2026-11-05 — replacedOriginal is recomputed, not frozen at write time", () => {
    const lesson = on(ownDays, "2026-11-05")?.lessons[0];
    expect(lesson?.origin).toBe("SUBSTITUTION");
    expect(lesson?.payload).toStrictEqual({ subject: "Фізика", className: "8-А" });
    expect(lesson?.replacedOriginal).toStrictEqual({
      subject: "Математика",
      className: "5-В",
    });
  });

  // §8.7: the one date where isNonTeaching and a lesson coexist. An expand()
  // that short-circuits on a non-teaching date loses the make-up lesson.
  it("2026-10-17 — a non-teaching day that still carries an override", () => {
    expect(on(ownDays, "2026-10-17")).toStrictEqual({
      date: "2026-10-17",
      parity: "NUMERATOR",
      isNonTeaching: true,
      lessons: [
        {
          lessonNumber: 3,
          timeFrom: "10:25",
          timeTo: "11:10",
          payload: { subject: "Відпрацювання", className: "7-А" },
          origin: "EDIT",
        },
      ],
    });
    // O6 is an OWN row and does not leak into the other view.
    expect(on(classDays, "2026-10-17")?.lessons).toStrictEqual([]);
  });

  // §8.8, the two "nothing underneath" cases.
  it("2026-11-10 — a SUBSTITUTION with no slot under it has no replacedOriginal", () => {
    const lesson = on(ownDays, "2026-11-10")?.lessons[0];
    expect(lesson?.origin).toBe("SUBSTITUTION");
    expect(lesson && "replacedOriginal" in lesson).toBe(false);
  });

  it("2026-11-12 — a CLEARED with no slot under it is a no-op", () => {
    expect(on(classDays, "2026-11-12")?.lessons).toStrictEqual([]);
    // The same date in the other view keeps its own template lesson.
    expect(on(ownDays, "2026-11-12")?.lessons).toHaveLength(1);
  });

  // §8.1: the version is chosen per date, not per week or per range.
  it("2026-W43 is served by two versions, switching mid-week", () => {
    expect(on(ownDays, "2026-10-20")?.lessons[0]?.payload).toStrictEqual({
      subject: "Геометрія",
      className: "9-А",
    });
    expect(on(ownDays, "2026-10-21")?.lessons[1]?.payload).toStrictEqual({
      subject: "Інформатика",
      className: "7-А",
    });
  });
});

/**
 * Not from the fixture — it has a bell row for every lesson number it uses. The
 * teacher can delete one while an override on that number survives, and the
 * lesson must still render, without time keys.
 */
describe("a lesson number with no BellSchedule row", () => {
  it("renders the lesson and omits timeFrom and timeTo", () => {
    const withoutBells = { ...FIXTURE, bells: [] };
    const lesson = expand(withoutBells, {
      from: "2026-10-17",
      to: "2026-10-17",
      view: "OWN",
    })[0].lessons[0];

    expect(lesson).toStrictEqual({
      lessonNumber: 3,
      payload: { subject: "Відпрацювання", className: "7-А" },
      origin: "EDIT",
    });
  });
});
