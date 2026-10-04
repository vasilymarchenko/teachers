import type { ScheduleView } from "@/lib/db/schema/enums";

/**
 * The values a lesson's free-text fields offer as suggestions — overview §4:
 * subjects, classes and teacher names are stored as text, with no dictionary
 * tables, and the form softens the cost of that by suggesting what the teacher
 * has already typed.
 *
 * Three lists, each sorted for display and holding every value once.
 */
export type LessonSuggestions = {
  /** From both views — `subject` is the one field `OWN` and `CLASS` share. */
  subjects: string[];
  /** From `OWN` only — specification §5.1. */
  classNames: string[];
  /** From `CLASS` only — specification §5.1. */
  teacherNames: string[];
};

/**
 * One stored payload's three suggestible fields, as the database hands them
 * over: a field the payload does not carry is `null`.
 */
export type SuggestionSource = {
  view: ScheduleView;
  subject: string | null;
  className: string | null;
  teacherName: string | null;
};

/**
 * Ukrainian collation, so «Історія» sorts after «Географія» rather than before
 * «Алгебра» as its code point would put it. `numeric` orders the number in a
 * class name by value: «8-А» before «10-А».
 */
const UKRAINIAN = new Intl.Collator("uk", { numeric: true });

/**
 * The three lists out of the payloads' fields.
 *
 * Each list reads the view its field belongs to, whatever keys a payload
 * happens to carry: the shape is enforced by Zod on the way in, not by the
 * database (schema §7), so the view is the one thing that is certain.
 *
 * Values are trimmed and compared exactly. Two spellings that differ only in
 * case are two values — overview §4 accepts «Математика» / «математика» as the
 * price of free text, and offering only one of them would hide which one the
 * teacher actually typed.
 */
export function collectSuggestions(
  rows: readonly SuggestionSource[],
): LessonSuggestions {
  const subjects = new Set<string>();
  const classNames = new Set<string>();
  const teacherNames = new Set<string>();

  for (const row of rows) {
    add(subjects, row.subject);
    if (row.view === "OWN") add(classNames, row.className);
    if (row.view === "CLASS") add(teacherNames, row.teacherName);
  }

  return {
    subjects: sorted(subjects),
    classNames: sorted(classNames),
    teacherNames: sorted(teacherNames),
  };
}

function add(values: Set<string>, value: string | null): void {
  const trimmed = value?.trim() ?? "";
  if (trimmed !== "") values.add(trimmed);
}

function sorted(values: Set<string>): string[] {
  return [...values].sort(UKRAINIAN.compare);
}
