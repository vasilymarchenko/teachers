import { describe, expect, it } from "vitest";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import { dayOverrideKindEnum } from "@/lib/db/schema/enums";
import { EDITABLE_OVERRIDE_KINDS } from "@/lib/validation/dayOverride";
import {
  dayTooltip,
  OVERRIDE_KIND_OPTIONS,
  OVERRIDE_LABELS,
  REMOVE_OVERRIDE_LABELS,
} from "./labels";

/**
 * The year view's cell shows a number and nothing else, so its tooltip is the
 * whole of what that day can say. The case worth pinning is the one the grid
 * would otherwise lose: a teaching day whose only lesson a `CLEARED` override
 * removed must not read as a free day (specification §5.3, fixtures §5, 10-19).
 */

function day(fields: Partial<CalendarDay>): CalendarDay {
  return {
    date: "2026-10-19",
    parity: "DENOMINATOR",
    isNonTeaching: false,
    lessons: [],
    cancelled: [],
    ...fields,
  };
}

const lesson = (lessonNumber: number) => ({
  lessonNumber,
  payload: { subject: "Математика", className: "7-А" },
  origin: "TEMPLATE" as const,
});

describe("dayTooltip", () => {
  it("counts the cancelled lessons of an otherwise empty day", () => {
    expect(dayTooltip(day({ cancelled: [lesson(1)] }))).toBe(
      "19 жовтня — уроків немає · скасовано: 1",
    );
  });

  it("counts them alongside the lessons that remain", () => {
    expect(
      dayTooltip(day({ lessons: [lesson(2)], cancelled: [lesson(1)] })),
    ).toBe("19 жовтня — уроків: 1 · скасовано: 1");
  });

  it("says nothing of cancellations when there are none", () => {
    expect(dayTooltip(day({ lessons: [lesson(1)] }))).toBe(
      "19 жовтня — уроків: 1",
    );
  });

  it("names a non-teaching day instead of counting", () => {
    expect(
      dayTooltip(
        day({ isNonTeaching: true, nonTeachingName: "Осінні канікули" }),
      ),
    ).toBe("19 жовтня — Осінні канікули");
  });
});

/**
 * The override editor's words — T-011. The suite has no DOM, so this is what
 * stands in for rendering the screen: a missing word is not a crash but a
 * button the teacher cannot read.
 */
describe("the override editor's labels", () => {
  it("offers exactly the kinds that carry a lesson", () => {
    // `CLEARED` is «Скасувати урок», its own button — it is not one of the
    // choices in the form (`lib/validation/dayOverride.ts`).
    expect(OVERRIDE_KIND_OPTIONS.map((option) => option.value)).toEqual([
      ...EDITABLE_OVERRIDE_KINDS,
    ]);

    for (const option of OVERRIDE_KIND_OPTIONS) {
      expect(option.label, option.value).toBeTruthy();
      expect(option.description, option.value).toBeTruthy();
    }
  });

  it("names the removal of every kind, the tombstone included", () => {
    // Removing a cancellation is «Повернути урок», not «Прибрати правку»: the
    // three kinds are undone for three different reasons (glossary §3).
    for (const kind of dayOverrideKindEnum.enumValues) {
      expect(REMOVE_OVERRIDE_LABELS[kind], kind).toBeTruthy();
    }
    expect(REMOVE_OVERRIDE_LABELS.CLEARED).not.toBe(
      REMOVE_OVERRIDE_LABELS.EDIT,
    );
  });

  it("says that a substitution follows a later change of the schedule", () => {
    // Overview §3.4: `replacedOriginal` is recomputed from the version in force
    // on the date, so it moves when the template does. T-011 requires the
    // screen not to promise otherwise — this is where it says so.
    expect(OVERRIDE_LABELS.substitutionHint).toContain("не зберігається");
    expect(OVERRIDE_LABELS.substitutionHint).toContain("зміниться");
  });

  it("says that a cancelled lesson stays visible, and that removing restores", () => {
    expect(OVERRIDE_LABELS.clearHint).toContain("закресленим");
    expect(OVERRIDE_LABELS.removeHint).toContain("тижневого розкладу");
  });

  it("titles the screen with the lesson and the date", () => {
    expect(OVERRIDE_LABELS.title(3, "2026-10-19")).toBe(
      "Урок 3 — Понеділок, 19 жовтня 2026 р.",
    );
  });
});
