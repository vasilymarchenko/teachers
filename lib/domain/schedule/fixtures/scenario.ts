import type { Parity, Weekday } from "@/lib/db/schema/enums";
import type {
  ClassSlotPayload,
  OwnSlotPayload,
} from "@/lib/validation/slotPayload";
import type { SemesterRange } from "../boundaries";
import type {
  DateRange,
  NonTeachingPeriodInput,
  ScheduleInput,
  TemplateSlotInput,
  TemplateVersionInput,
} from "../types";

/**
 * The fixture input of `docs/architecture/design/expand-fixtures.md` §3, as the
 * domain sees it. That document is authoritative; this file transcribes it, and
 * **a value here that does not appear in the fixture is a bug here.** Section
 * references below point at the rows each block came from.
 *
 * `scripts/seed.ts` transcribes the same §3 into database rows. The two
 * transcriptions are deliberately independent (fixtures §10): one feeds the demo
 * database, the other feeds the unit suite, and a divergence between them is a
 * transcription error worth finding.
 */

/** Fixtures §1 — the window both views are expanded over. Both ends inclusive. */
export const WINDOW: DateRange = { from: "2026-10-12", to: "2026-11-13" };

/** Fixtures §3.1 — AcademicYear Y1. */
export const YEAR = { dateFrom: "2026-09-01", dateTo: "2027-05-31" };

/** Fixtures §3.1 — S1 and S2. */
export const SEMESTERS: SemesterRange[] = [
  { dateFrom: "2026-09-01", dateTo: "2026-12-24" },
  { dateFrom: "2027-01-12", dateTo: "2027-05-31" },
];

/** Fixtures §3.2 — P2, the only `BREAK`; P1 is a `PUBLIC_HOLIDAY`. */
export const BREAKS: NonTeachingPeriodInput[] = [
  { dateFrom: "2026-10-26", dateTo: "2026-11-01" },
];

const own = (subject: string, className: string): OwnSlotPayload => ({
  subject,
  className,
});

const cls = (
  subject: string,
  teacherName: string,
  zoomLink: string,
  note?: string,
): ClassSlotPayload =>
  note === undefined
    ? { subject, teacherName, zoomLink }
    : { subject, teacherName, zoomLink, note };

/**
 * One row of a §3.6 table: the two parity columns of one
 * `(weekday, lessonNumber)`. `null` is the `—` of the fixture — no slot at all,
 * not a slot with an empty payload.
 */
type Cell = [
  weekday: Weekday,
  lessonNumber: number,
  numerator: OwnSlotPayload | ClassSlotPayload | null,
  denominator: OwnSlotPayload | ClassSlotPayload | null,
];

const slotsOf = (cells: Cell[]): TemplateSlotInput[] =>
  cells.flatMap(([weekday, lessonNumber, numerator, denominator]) =>
    (
      [
        ["NUMERATOR", numerator],
        ["DENOMINATOR", denominator],
      ] as [Parity, OwnSlotPayload | ClassSlotPayload | null][]
    )
      .filter(([, payload]) => payload !== null)
      .map(([parity, payload]) => ({
        weekday,
        lessonNumber,
        parity,
        payload: payload as OwnSlotPayload | ClassSlotPayload,
      })),
  );

/** Fixtures §3.6, `TemplateSlot` — OWN-V1. */
const OWN_V1_CELLS: Cell[] = [
  ["MON", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["MON", 2, own("Алгебра", "9-А"), null],
  ["TUE", 2, own("Геометрія", "9-А"), own("Геометрія", "9-А")],
  ["WED", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["WED", 3, own("Інформатика", "7-А"), own("Алгебра", "9-А")],
  ["THU", 2, own("Математика", "6-Б"), own("Математика", "6-Б")],
  ["FRI", 1, own("Математика", "6-Б"), own("Математика", "6-Б")],
];

/** Fixtures §3.6, `TemplateSlot` — OWN-V2. */
const OWN_V2_CELLS: Cell[] = [
  ["MON", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["MON", 2, own("Алгебра", "9-А"), own("Алгебра", "9-А")],
  ["TUE", 2, own("Геометрія", "9-А"), null],
  ["WED", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["WED", 3, own("Інформатика", "7-А"), own("Інформатика", "7-А")],
  ["THU", 2, own("Математика", "5-В"), own("Алгебра", "9-А")],
  ["FRI", 1, own("Математика", "5-В"), own("Геометрія", "9-А")],
];

export const MATH_7A = cls(
  "Математика",
  "Ковальчук М. І.",
  "https://zoom.us/j/7a-math",
);
export const UKR_7A = cls(
  "Українська мова",
  "Шевченко О. П.",
  "https://zoom.us/j/7a-ukr",
);
export const IT_7A = cls(
  "Інформатика",
  "Ковальчук М. І.",
  "https://zoom.us/j/7a-it",
);
export const PHYS_7A = cls(
  "Фізика",
  "Ткаченко Л. В.",
  "https://zoom.us/j/7a-phys",
);

/** Fixtures §3.6, `TemplateSlot` — CLASS-V1, class 7-А. */
const CLASS_V1_CELLS: Cell[] = [
  ["MON", 1, MATH_7A, MATH_7A],
  ["MON", 2, UKR_7A, UKR_7A],
  ["WED", 1, MATH_7A, MATH_7A],
  [
    "WED",
    3,
    cls("Інформатика", "Ковальчук М. І.", "https://zoom.us/j/7a-it", "кабінет 12"),
    cls("Історія", "Бондар І. С.", "https://zoom.us/j/7a-hist"),
  ],
];

/** Fixtures §3.6, `TemplateSlot` — CLASS-V2, class 7-А. */
const CLASS_V2_CELLS: Cell[] = [
  ["MON", 1, MATH_7A, MATH_7A],
  ["MON", 2, UKR_7A, UKR_7A],
  ["WED", 1, MATH_7A, MATH_7A],
  ["WED", 3, IT_7A, IT_7A],
  ["FRI", 2, PHYS_7A, PHYS_7A],
];

/** Fixtures §3.6 — the four versions, at their final intervals (§10). */
export const TEMPLATES: TemplateVersionInput[] = [
  {
    view: "OWN",
    validFrom: "2026-09-01",
    validTo: "2026-10-21",
    slots: slotsOf(OWN_V1_CELLS),
  },
  {
    view: "OWN",
    validFrom: "2026-10-21",
    validTo: "2026-12-25",
    slots: slotsOf(OWN_V2_CELLS),
  },
  {
    view: "CLASS",
    validFrom: "2026-09-01",
    validTo: "2026-10-21",
    slots: slotsOf(CLASS_V1_CELLS),
  },
  {
    view: "CLASS",
    validFrom: "2026-11-02",
    validTo: "2026-12-25",
    slots: slotsOf(CLASS_V2_CELLS),
  },
];

/** The whole of §3, ready for `expand()`. */
export const FIXTURE: ScheduleInput = {
  // §3.5 — A1 the year's initial value, A2 the mid-week reset.
  anchors: [
    { date: "2026-09-01", parity: "NUMERATOR" },
    { date: "2026-11-04", parity: "NUMERATOR" },
  ],
  // §3.2 — P1 the one-day holiday, P2 the full break week.
  nonTeachingPeriods: [
    { dateFrom: "2026-10-14", dateTo: "2026-10-14" },
    ...BREAKS,
  ],
  // §3.3 — R1 the methodical day, R2/R3 the weekend.
  weekdayRules: [
    { weekday: "FRI", validFrom: "2026-09-01", boundaryDate: "2026-10-26" },
    { weekday: "SAT", validFrom: "2026-09-01", boundaryDate: "2027-06-01" },
    { weekday: "SUN", validFrom: "2026-09-01", boundaryDate: "2027-06-01" },
  ],
  // §3.4 — only the lesson numbers in use have rows.
  bells: [
    { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
    { lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
    { lessonNumber: 3, timeFrom: "10:25", timeTo: "11:10" },
    { lessonNumber: 4, timeFrom: "11:20", timeTo: "12:05" },
    { lessonNumber: 5, timeFrom: "12:15", timeTo: "13:00" },
  ],
  templates: TEMPLATES,
  // §3.7 — O1 … O8. A CLEARED override carries no payload.
  overrides: [
    {
      date: "2026-10-13",
      view: "OWN",
      lessonNumber: 2,
      kind: "EDIT",
      payload: own("Алгебра (контрольна)", "9-А"),
    },
    { date: "2026-10-19", view: "OWN", lessonNumber: 1, kind: "CLEARED" },
    {
      date: "2026-11-05",
      view: "OWN",
      lessonNumber: 2,
      kind: "SUBSTITUTION",
      payload: own("Фізика", "8-А"),
    },
    {
      date: "2026-10-22",
      view: "CLASS",
      lessonNumber: 1,
      kind: "EDIT",
      payload: {
        subject: "Виховна година",
        teacherName: "Шевченко О. П.",
        note: "замість уроків",
      },
    },
    { date: "2026-11-09", view: "CLASS", lessonNumber: 2, kind: "CLEARED" },
    {
      date: "2026-10-17",
      view: "OWN",
      lessonNumber: 3,
      kind: "EDIT",
      payload: own("Відпрацювання", "7-А"),
    },
    {
      date: "2026-11-10",
      view: "OWN",
      lessonNumber: 2,
      kind: "SUBSTITUTION",
      payload: own("Хімія", "8-А"),
    },
    { date: "2026-11-12", view: "CLASS", lessonNumber: 3, kind: "CLEARED" },
  ],
};
