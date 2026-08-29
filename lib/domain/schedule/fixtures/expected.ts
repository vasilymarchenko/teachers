import type { Parity } from "@/lib/db/schema/enums";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import type { IsoDate } from "@/lib/time/today";
import type { LessonOrigin, ResolvedDay, ResolvedLesson } from "../types";
import { IT_7A, MATH_7A, PHYS_7A, UKR_7A } from "./scenario";

/**
 * The expected output of `docs/architecture/design/expand-fixtures.md` §6
 * (`OWN`) and §7 (`CLASS`), one entry per row of those tables.
 *
 * Every value was transcribed from the document, which derived it by hand from
 * the rules in overview §3. **No expectation here was obtained by running
 * `expand()`.** A test that fails against this file is a claim that the
 * implementation disagrees with the document, and the document wins until it is
 * changed on purpose.
 */

/** Fixtures §3.4 — the bell rows the window actually uses. */
const BELL: Record<number, { timeFrom: string; timeTo: string }> = {
  1: { timeFrom: "08:30", timeTo: "09:15" },
  2: { timeFrom: "09:25", timeTo: "10:10" },
  3: { timeFrom: "10:25", timeTo: "11:10" },
};

function lesson(
  lessonNumber: number,
  payload: SlotPayload,
  origin: LessonOrigin,
  extras: { replacedOriginal?: SlotPayload; isTaughtByMe?: boolean } = {},
): ResolvedLesson {
  return {
    lessonNumber,
    ...BELL[lessonNumber],
    payload,
    origin,
    // Spread conditionally: an absent optional field means the key is absent,
    // and `toStrictEqual` is what holds the implementation to that (§8.8).
    ...(extras.replacedOriginal === undefined
      ? {}
      : { replacedOriginal: extras.replacedOriginal }),
    ...(extras.isTaughtByMe === undefined
      ? {}
      : { isTaughtByMe: extras.isTaughtByMe }),
  };
}

const day = (
  date: IsoDate,
  parity: Parity,
  isNonTeaching: boolean,
  lessons: ResolvedLesson[] = [],
): ResolvedDay => ({ date, parity, isNonTeaching, lessons });

const own = (subject: string, className: string): SlotPayload => ({
  subject,
  className,
});

const MATH_7A_OWN = own("Математика", "7-А");
const ALGEBRA_9A = own("Алгебра", "9-А");
const GEOMETRY_9A = own("Геометрія", "9-А");
const IT_7A_OWN = own("Інформатика", "7-А");

const N = "NUMERATOR";
const D = "DENOMINATOR";

/** Fixtures §6 — `expand(WINDOW, view = OWN)`, 33 days. */
export const EXPECTED_OWN: ResolvedDay[] = [
  // 2026-W42 — NUMERATOR, OWN-V1.
  day("2026-10-12", N, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(2, ALGEBRA_9A, "TEMPLATE"),
  ]),
  day("2026-10-13", N, false, [
    lesson(2, own("Алгебра (контрольна)", "9-А"), "EDIT"),
  ]),
  day("2026-10-14", N, true),
  day("2026-10-15", N, false, [lesson(2, own("Математика", "6-Б"), "TEMPLATE")]),
  day("2026-10-16", N, true),
  // The one date in the window where `isNonTeaching` and a lesson coexist (§8.7).
  day("2026-10-17", N, true, [lesson(3, own("Відпрацювання", "7-А"), "EDIT")]),
  day("2026-10-18", N, true),

  // 2026-W43 — DENOMINATOR, OWN-V1 until Tue, OWN-V2 from Wed.
  // 10-19: CLEARED, so a teaching day with no lessons.
  day("2026-10-19", D, false),
  day("2026-10-20", D, false, [lesson(2, GEOMETRY_9A, "TEMPLATE")]),
  day("2026-10-21", D, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(3, IT_7A_OWN, "TEMPLATE"),
  ]),
  day("2026-10-22", D, false, [lesson(2, ALGEBRA_9A, "TEMPLATE")]),
  day("2026-10-23", D, true),
  day("2026-10-24", D, true),
  day("2026-10-25", D, true),

  // 2026-W44 — NUMERATOR, the full break week.
  day("2026-10-26", N, true),
  day("2026-10-27", N, true),
  day("2026-10-28", N, true),
  day("2026-10-29", N, true),
  day("2026-10-30", N, true),
  day("2026-10-31", N, true),
  day("2026-11-01", N, true),

  // 2026-W45 — split parity at the mid-week anchor A2, OWN-V2.
  day("2026-11-02", D, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(2, ALGEBRA_9A, "TEMPLATE"),
  ]),
  // 11-03: no TUE/DENOMINATOR slot in OWN-V2 — empty, and not for any other reason.
  day("2026-11-03", D, false),
  day("2026-11-04", N, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(3, IT_7A_OWN, "TEMPLATE"),
  ]),
  // 11-05: `replacedOriginal` recomputed from the version and parity in force
  // on this date, not frozen at the write (§8.4).
  day("2026-11-05", N, false, [
    lesson(2, own("Фізика", "8-А"), "SUBSTITUTION", {
      replacedOriginal: own("Математика", "5-В"),
    }),
  ]),
  day("2026-11-06", N, false, [lesson(1, own("Математика", "5-В"), "TEMPLATE")]),
  day("2026-11-07", N, true),
  day("2026-11-08", N, true),

  // 2026-W46 — DENOMINATOR via A2, OWN-V2.
  day("2026-11-09", D, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(2, ALGEBRA_9A, "TEMPLATE"),
  ]),
  // 11-10: SUBSTITUTION with no slot underneath — no `replacedOriginal` key.
  day("2026-11-10", D, false, [lesson(2, own("Хімія", "8-А"), "SUBSTITUTION")]),
  day("2026-11-11", D, false, [
    lesson(1, MATH_7A_OWN, "TEMPLATE"),
    lesson(3, IT_7A_OWN, "TEMPLATE"),
  ]),
  day("2026-11-12", D, false, [lesson(2, ALGEBRA_9A, "TEMPLATE")]),
  day("2026-11-13", D, false, [lesson(1, GEOMETRY_9A, "TEMPLATE")]),
];

/** Fixtures §7 — `expand(WINDOW, view = CLASS)`, the same 33 dates. */
export const EXPECTED_CLASS: ResolvedDay[] = [
  // 2026-W42 — NUMERATOR, CLASS-V1.
  day("2026-10-12", N, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: true }),
    lesson(2, UKR_7A, "TEMPLATE", { isTaughtByMe: false }),
  ]),
  day("2026-10-13", N, false),
  day("2026-10-14", N, true),
  day("2026-10-15", N, false),
  day("2026-10-16", N, true),
  // O6 is an OWN row, so the CLASS view of the same Saturday stays empty.
  day("2026-10-17", N, true),
  day("2026-10-18", N, true),

  // 2026-W43 — DENOMINATOR, CLASS-V1 until Tue, then the version gap.
  // 10-19: O2 cleared the teacher's own lesson 1, so the class's is no longer theirs.
  day("2026-10-19", D, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: false }),
    lesson(2, UKR_7A, "TEMPLATE", { isTaughtByMe: false }),
  ]),
  day("2026-10-20", D, false),
  // 10-21: inside the CLASS version gap — a teaching day with no lessons.
  day("2026-10-21", D, false),
  // 10-22: O4 renders although the gap leaves nothing under it.
  day("2026-10-22", D, false, [
    lesson(
      1,
      {
        subject: "Виховна година",
        teacherName: "Шевченко О. П.",
        note: "замість уроків",
      },
      "EDIT",
      { isTaughtByMe: false },
    ),
  ]),
  day("2026-10-23", D, true),
  day("2026-10-24", D, true),
  day("2026-10-25", D, true),

  // 2026-W44 — the break week, empty for two independent reasons.
  day("2026-10-26", N, true),
  day("2026-10-27", N, true),
  day("2026-10-28", N, true),
  day("2026-10-29", N, true),
  day("2026-10-30", N, true),
  day("2026-10-31", N, true),
  day("2026-11-01", N, true),

  // 2026-W45 — CLASS-V2 from Mon.
  day("2026-11-02", D, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: true }),
    // Same lessonNumber as the teacher's own lesson, different subject.
    lesson(2, UKR_7A, "TEMPLATE", { isTaughtByMe: false }),
  ]),
  day("2026-11-03", D, false),
  day("2026-11-04", N, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: true }),
    lesson(3, IT_7A, "TEMPLATE", { isTaughtByMe: true }),
  ]),
  day("2026-11-05", N, false),
  // 11-06: the class has FRI/2, the teacher FRI/1 — different lessonNumber.
  day("2026-11-06", N, false, [
    lesson(2, PHYS_7A, "TEMPLATE", { isTaughtByMe: false }),
  ]),
  day("2026-11-07", N, true),
  day("2026-11-08", N, true),

  // 2026-W46 — DENOMINATOR via A2, CLASS-V2.
  // 11-09: O5 cleared lesson 2 here while the OWN view keeps its own.
  day("2026-11-09", D, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: true }),
  ]),
  day("2026-11-10", D, false),
  day("2026-11-11", D, false, [
    lesson(1, MATH_7A, "TEMPLATE", { isTaughtByMe: true }),
    lesson(3, IT_7A, "TEMPLATE", { isTaughtByMe: true }),
  ]),
  // 11-12: O8 is a CLEARED over an absent slot — a no-op.
  day("2026-11-12", D, false),
  day("2026-11-13", D, false, [
    lesson(2, PHYS_7A, "TEMPLATE", { isTaughtByMe: false }),
  ]),
];
