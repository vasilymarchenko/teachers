import { describe, expect, it } from "vitest";
import { FIXTURE, WINDOW } from "@/lib/domain/schedule/fixtures/scenario";
import { buildCalendarDays, type CalendarDay } from "./days";
import type { NamedNonTeachingPeriod } from "./days";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";

/**
 * The rendering-level merge, against the fixture of
 * `docs/architecture/design/expand-fixtures.md`.
 *
 * Every expectation below is read off that document — §5 for the `OWN` days,
 * §6 for the `CLASS` days, §8.7 and §8.8 for the edges. None of it was obtained
 * by running the code.
 */

/** Fixtures §3.2 — P1 the one-day holiday, P2 the autumn break. */
const PERIODS: NamedNonTeachingPeriod[] = [
  {
    name: "День захисників і захисниць України",
    dateFrom: "2026-10-14",
    dateTo: "2026-10-14",
  },
  { name: "Осінні канікули", dateFrom: "2026-10-26", dateTo: "2026-11-01" },
];

function dayOn(date: IsoDate, view: ScheduleView): CalendarDay {
  const days = buildCalendarDays(FIXTURE, { ...WINDOW, view }, PERIODS);
  const day = days.find((candidate) => candidate.date === date);
  if (day === undefined) throw new Error(`${date} is outside the window`);
  return day;
}

describe("cancelled lessons", () => {
  it("keeps a CLEARED lesson visible, and out of `lessons` (fixtures §5, 10-19)", () => {
    // O2 clears OWN-V1's `MON/DENOMINATOR` slot. The day is a **teaching** day
    // with no lessons — the fixture's own «day that separates cancelled from
    // non-teaching».
    const day = dayOn("2026-10-19", "OWN");

    expect(day.isNonTeaching).toBe(false);
    expect(day.lessons).toEqual([]);
    expect(day.cancelled).toEqual([
      {
        lessonNumber: 1,
        timeFrom: "08:30",
        timeTo: "09:15",
        payload: { subject: "Математика", className: "7-А" },
        origin: "TEMPLATE",
      },
    ]);
  });

  it("renders nothing for a tombstone with no slot under it (§8.8, 11-12)", () => {
    // O8 clears a `CLASS` lesson on a Thursday CLASS-V2 has no slot for: it
    // gags nothing, so it must not become a phantom cancelled lesson either.
    const day = dayOn("2026-11-12", "CLASS");

    expect(day.lessons).toEqual([]);
    expect(day.cancelled).toEqual([]);
  });

  it("cancels in one view only (fixtures §6, 11-09)", () => {
    // O5 takes `2 · Українська мова` off the CLASS day; the OWN day keeps its
    // own second lesson, because `DayOverride` is keyed by `view`.
    const classDay = dayOn("2026-11-09", "CLASS");
    expect(classDay.lessons.map((lesson) => lesson.lessonNumber)).toEqual([1]);
    expect(classDay.cancelled).toHaveLength(1);
    expect(classDay.cancelled[0].lessonNumber).toBe(2);
    expect(classDay.cancelled[0].payload.subject).toBe("Українська мова");

    const ownDay = dayOn("2026-11-09", "OWN");
    expect(ownDay.cancelled).toEqual([]);
    expect(ownDay.lessons.map((lesson) => lesson.lessonNumber)).toEqual([1, 2]);
  });

  it("leaves an EDIT and a SUBSTITUTION out of `cancelled` (fixtures §5)", () => {
    // O1 edits 10-13's second lesson and O3 substitutes 11-05's: both keep
    // their `lessonNumber`, so neither is a cancellation.
    expect(dayOn("2026-10-13", "OWN").cancelled).toEqual([]);

    const substituted = dayOn("2026-11-05", "OWN");
    expect(substituted.cancelled).toEqual([]);
    expect(
      substituted.lessons.find((lesson) => lesson.lessonNumber === 2)?.origin,
    ).toBe("SUBSTITUTION");
  });

  it("has nothing to cancel on a non-teaching date", () => {
    // The break suppresses the template in both expansions, so the diff is
    // empty: a break week is not seven days of cancelled lessons.
    expect(dayOn("2026-10-28", "OWN").cancelled).toEqual([]);
  });
});

describe("the name of a non-teaching day", () => {
  it("names the NonTeachingPeriod that covers it (fixtures §3.2)", () => {
    expect(dayOn("2026-10-26", "OWN").nonTeachingName).toBe("Осінні канікули");
    expect(dayOn("2026-10-14", "OWN").nonTeachingName).toBe(
      "День захисників і захисниць України",
    );
  });

  it("has no name when a weekday rule made the day non-teaching (10-17)", () => {
    // R2 is a weekday rule — a weekday has no name to give — and O6 puts a
    // make-up lesson on that same Saturday (§8.7): non-teaching and non-empty
    // at once.
    const day = dayOn("2026-10-17", "OWN");

    expect(day.isNonTeaching).toBe(true);
    expect(day.nonTeachingName).toBeUndefined();
    expect(day.lessons.map((lesson) => lesson.payload.subject)).toEqual([
      "Відпрацювання",
    ]);
  });

  it("names the shorter period when two cover the same date", () => {
    // A `PUBLIC_HOLIDAY` inside a `BREAK` is normal (fixtures §6): the holiday
    // is what the teacher wants named on its own day.
    const periods: NamedNonTeachingPeriod[] = [
      ...PERIODS,
      { name: "День Хеловіну", dateFrom: "2026-10-31", dateTo: "2026-10-31" },
    ];
    const days = buildCalendarDays(
      FIXTURE,
      { from: "2026-10-31", to: "2026-10-31", view: "OWN" },
      periods,
    );

    expect(days[0].nonTeachingName).toBe("День Хеловіну");
  });

  it("leaves a teaching day unnamed even inside a period's dates", () => {
    expect(dayOn("2026-10-13", "OWN").nonTeachingName).toBeUndefined();
  });
});

describe("the window itself", () => {
  it("returns one day per date, in order, and nothing else", () => {
    const days = buildCalendarDays(FIXTURE, { ...WINDOW, view: "OWN" }, PERIODS);

    // 2026-10-12 … 2026-11-13 inclusive — fixtures §1.
    expect(days).toHaveLength(33);
    expect(days[0].date).toBe("2026-10-12");
    expect(days.at(-1)?.date).toBe("2026-11-13");
  });

  it("keeps `isTaughtByMe` from the expansion (fixtures §8.6, 10-19)", () => {
    // The comparison is against the **resolved** OWN day, which O2 emptied:
    // the CLASS lesson is not taught by the teacher on 10-19.
    const day = dayOn("2026-10-19", "CLASS");

    expect(day.lessons.map((lesson) => lesson.isTaughtByMe)).toEqual([
      false,
      false,
    ]);
  });

  it("never answers `isTaughtByMe` for a cancelled lesson (§8.6, 10-19)", () => {
    // The override-free expansion resolves the flag against the **planned**
    // OWN day, where O2 has not emptied 10-19 — so «Математика» at number 1
    // would come back `isTaughtByMe: true` on a date where §8.6 says the
    // answer is `false`. A cancelled lesson therefore carries no flag at all.
    const cleared = {
      ...FIXTURE,
      overrides: [
        ...FIXTURE.overrides,
        {
          date: "2026-10-19" as IsoDate,
          view: "CLASS" as ScheduleView,
          lessonNumber: 1,
          kind: "CLEARED" as const,
        },
      ],
    };
    const days = buildCalendarDays(cleared, { ...WINDOW, view: "CLASS" });
    const day = days.find((candidate) => candidate.date === "2026-10-19");

    expect(day?.cancelled.map((lesson) => lesson.lessonNumber)).toEqual([1]);
    expect(day?.cancelled[0]).not.toHaveProperty("isTaughtByMe");
  });
});
