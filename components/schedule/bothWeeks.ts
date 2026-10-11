import type { Parity, ScheduleView } from "@/lib/db/schema/enums";
import { otherParity } from "@/lib/domain/schedule/templateSlots";
import { sameLesson, SLOT_FIELDS } from "@/lib/validation/slotFields";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import { templateBothWeeksField } from "@/lib/validation/templateDay";
import { BOTH_WEEKS_LABELS } from "./labels";

/**
 * The «в обох тижнях» toggle's side of a row — T-043, ADR-025.
 *
 * Nothing here touches the DOM. The page knows, when it renders, what both
 * weeks store at a lesson number; what it cannot know is whether the teacher
 * will switch the toggle on or empty the row. So the server renders every
 * sentence the row's line could need and CSS shows one, from the checkbox
 * (`:checked`) and from whether every lesson field is empty
 * (`:placeholder-shown`) — `app/globals.css`, under `[data-both-row]`. That is
 * what makes the line work with JavaScript off, and `shownLine()` is the same
 * rule written once more, for the suite, which has no DOM.
 */

/** The candidate texts of one row's line. Absent means the line is empty. */
export type RowLine = {
  /** Toggle off: what the other week has, if it differs. */
  off?: string;
  /** Toggle on and the row holds a lesson: what the save will write there. */
  filled?: string;
  /** Toggle on and the row is empty: what the save will remove there. */
  empty?: string;
};

/** The view's non-empty fields, in the form's order — «Фізика · 7-А». */
function lessonText(view: ScheduleView, payload: SlotPayload): string {
  const record = payload as Partial<Record<string, unknown>>;
  return SLOT_FIELDS[view]
    .map((field) => record[field])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" · ");
}

/**
 * The line under one row's header, from what both weeks store there.
 *
 * `own` is the week on the screen (`parity`), `other` the week the toggle
 * writes into. Equal is `sameLesson()`, the one definition of it.
 */
export function rowLine(
  view: ScheduleView,
  parity: Parity,
  own: SlotPayload | undefined,
  other: SlotPayload | undefined,
): RowLine {
  const week = otherParity(parity);
  const equal = sameLesson(view, own, other);

  const off = equal
    ? undefined
    : other === undefined
      ? BOTH_WEEKS_LABELS.otherEmpty(week)
      : BOTH_WEEKS_LABELS.otherHas(week, lessonText(view, other));

  const filled =
    other === undefined
      ? BOTH_WEEKS_LABELS.willAdd(week)
      : equal
        ? BOTH_WEEKS_LABELS.willWrite(week)
        : BOTH_WEEKS_LABELS.willReplace(week, other.subject);

  const empty =
    other === undefined ? undefined : BOTH_WEEKS_LABELS.willRemove(week, other.subject);

  return { off, filled, empty };
}

/**
 * Whether a row's lesson fields hold no lesson — as the save reads them, after
 * trimming, so a row of spaces is empty. CSS alone can only tell an input that
 * shows its placeholder; with JavaScript on, `BothWeeksToggle` writes this
 * answer onto the row (`data-row-blank`) and the CSS prefers it.
 */
export function rowIsBlank(values: readonly string[]): boolean {
  return values.every((value) => value.trim() === "");
}

/** Which candidate the CSS shows — the rule of `app/globals.css`, for tests. */
export function shownLine(
  line: RowLine,
  { checked, empty }: { checked: boolean; empty: boolean },
): string | undefined {
  if (!checked) return line.off;
  return empty ? line.empty : line.filled;
}

/**
 * The toggles T-047 leaves out of its comparison: those on rows equal in both
 * weeks, where switching the toggle alone writes nothing new. A toggle on a
 * row that differs takes part — switching it on changes the other week.
 */
export function untrackedToggles(
  view: ScheduleView,
  lessonNumbers: readonly number[],
  own: ReadonlyMap<number, SlotPayload>,
  other: ReadonlyMap<number, SlotPayload>,
): string[] {
  return lessonNumbers
    .filter((lessonNumber) =>
      sameLesson(view, own.get(lessonNumber), other.get(lessonNumber)),
    )
    .map(templateBothWeeksField);
}
