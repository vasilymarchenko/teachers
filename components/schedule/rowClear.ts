import type { ScheduleView } from "@/lib/db/schema/enums";
import {
  TEMPLATE_SLOT_FIELDS,
  templateSlotField,
} from "@/lib/validation/templateDay";

/**
 * Clearing one lesson row of the day form by an icon, and undoing that clear
 * before the save — T-046, `design/T-010-weekly-template-editor.md` §5.
 *
 * Nothing here touches the DOM, so the rules are tested in the `node`
 * environment the suite runs in; `RowActions` reads the row's inputs, hands
 * their values over and writes back what comes out. The clear only empties
 * fields in the browser: the lesson is removed by the day's «Зберегти», as an
 * emptied row always has been.
 */

/**
 * The `name=` of every lesson field of one row — the inputs of
 * `TEMPLATE_SLOT_FIELDS[view]` for that lesson number, in that order. These are
 * the only inputs a clear or an undo may change.
 */
export function rowLessonFields(
  view: ScheduleView,
  lessonNumber: number,
): string[] {
  return TEMPLATE_SLOT_FIELDS[view].map((field) =>
    templateSlotField(lessonNumber, field),
  );
}

/**
 * One row as the icon sees it: its lesson field values, in `rowLessonFields()`
 * order, and what a clear by icon took away — `null` when there is nothing to
 * put back.
 */
export type RowClearState = {
  values: readonly string[];
  kept: readonly string[] | null;
};

export type RowClearEvent =
  /** The row's fields were read: the teacher typed, or the page re-rendered. */
  | { type: "read"; values: readonly string[] }
  /** The clear icon was activated. */
  | { type: "clear" }
  /** The undo icon was activated. */
  | { type: "undo" }
  /** The form was reset — React does it after every submission. */
  | { type: "reset"; values: readonly string[] };

/** What the row header shows: the clear icon, the undo icon, or nothing. */
export type RowIcon = "clear" | "undo" | null;

/** A row holds a lesson when any of its lesson fields is not empty. */
export function rowHasLesson(values: readonly string[]): boolean {
  return values.some((value) => value !== "");
}

export function rowClearReducer(
  state: RowClearState,
  event: RowClearEvent,
): RowClearState {
  switch (event.type) {
    case "read":
      // A row emptied by the clear stays undoable while it is empty — the clear
      // itself is read back as an empty row. Typing into it again is a new
      // lesson, and what the clear took away is no longer offered.
      if (sameValues(state.values, event.values)) return state;
      return {
        values: event.values,
        kept: rowHasLesson(event.values) ? null : state.kept,
      };
    case "clear":
      // What the row holds now, unsaved edits included — not what the page
      // rendered.
      return {
        values: state.values.map(() => ""),
        kept: state.values,
      };
    case "undo":
      return state.kept === null
        ? state
        : { values: state.kept, kept: null };
    case "reset":
      // «До збереження»: once the form has been submitted, a clear is no
      // longer undone here.
      return { values: event.values, kept: null };
  }
}

export function rowIcon(state: RowClearState): RowIcon {
  if (rowHasLesson(state.values)) return "clear";
  return state.kept === null ? null : "undo";
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
