import type {
  DayOverrideKind,
  Parity,
  ScheduleView,
  Weekday,
} from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import type { SlotPayload } from "@/lib/validation/slotPayload";

/**
 * The public domain types of `docs/architecture/architect-overview.md` §5, plus
 * the input contract `expand()` reads. Mechanics:
 * `docs/architecture/design/T-005-schedule-domain.md`.
 *
 * Everything here is plain data. The domain never touches Drizzle or Next.js:
 * the `import type` lines above are erased at compile time, and they exist so
 * that the enum unions have exactly one definition
 * (`docs/architecture/design/schema.md` §2).
 */

/** Where a `ResolvedLesson` came from (overview §5). */
export type LessonOrigin = "TEMPLATE" | "EDIT" | "SUBSTITUTION";

/**
 * One computed lesson on one date — the merge of a `TemplateSlot`, the parity of
 * the date and any `DayOverride` on it.
 *
 * An absent optional field means the key is absent: never `null`, never an empty
 * string (`docs/architecture/design/expand-fixtures.md` §8.8).
 */
export type ResolvedLesson = {
  lessonNumber: number;
  /** From `BellSchedule`; absent when that lesson number has no bell row. */
  timeFrom?: string;
  timeTo?: string;
  payload: SlotPayload;
  origin: LessonOrigin;
  /** Only under `SUBSTITUTION`, and only when a slot is in force underneath. */
  replacedOriginal?: SlotPayload;
  /** Only in the `CLASS` view, where it is always present. */
  isTaughtByMe?: boolean;
};

/**
 * One date. `isNonTeaching` and a non-empty `lessons` are independent: a
 * non-teaching date suppresses lessons with `origin = TEMPLATE` and nothing else
 * (overview §3.4, fixtures §8.7).
 */
export type ResolvedDay = {
  date: IsoDate;
  parity: Parity;
  isNonTeaching: boolean;
  lessons: ResolvedLesson[];
};

/** Both ends inclusive — an entity range, not a validity boundary (§8.1). */
export type DateRange = { from: IsoDate; to: IsoDate };

/** `date` is inclusive: the anchor is in force from it onwards. */
export type ParityAnchorInput = { date: IsoDate; parity: Parity };

/** `dateFrom` and `dateTo` both inclusive; a one-day holiday has them equal. */
export type NonTeachingPeriodInput = { dateFrom: IsoDate; dateTo: IsoDate };

/** Applies to a date `d` while `validFrom <= d < boundaryDate` (§8.1). */
export type NonTeachingWeekdayRuleInput = {
  weekday: Weekday;
  validFrom: IsoDate;
  boundaryDate: IsoDate;
};

/** Clock times, passed through to `ResolvedLesson` unchanged. */
export type BellInput = {
  lessonNumber: number;
  timeFrom: string;
  timeTo: string;
};

export type TemplateSlotInput = {
  weekday: Weekday;
  lessonNumber: number;
  parity: Parity;
  payload: SlotPayload;
};

/** One version: `[validFrom, validTo)`, `validTo` exclusive (§3.2). */
export type TemplateVersionInput = {
  view: ScheduleView;
  validFrom: IsoDate;
  validTo: IsoDate;
  slots: TemplateSlotInput[];
};

/** `payload` is absent exactly when `kind = 'CLEARED'` (schema §4.9). */
export type DayOverrideInput = {
  date: IsoDate;
  view: ScheduleView;
  lessonNumber: number;
  kind: DayOverrideKind;
  payload?: SlotPayload;
};

/**
 * Everything `expand()` needs, already read and already parsed.
 *
 * `templates` and `overrides` carry **both** views whichever view is asked for:
 * `isTaughtByMe` on a `CLASS` lesson is decided against the resolved `OWN` day
 * for the same date, not against the `OWN` template (fixtures §8.6).
 *
 * Payloads arrive parsed by `lib/validation/slotPayload.ts` — `jsonb` is
 * `unknown` at the type level and a cast is not a check (schema §7).
 */
export type ScheduleInput = {
  anchors: readonly ParityAnchorInput[];
  nonTeachingPeriods: readonly NonTeachingPeriodInput[];
  weekdayRules: readonly NonTeachingWeekdayRuleInput[];
  bells: readonly BellInput[];
  templates: readonly TemplateVersionInput[];
  overrides: readonly DayOverrideInput[];
};
