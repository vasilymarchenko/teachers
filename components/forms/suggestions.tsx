import type { LessonSuggestions } from "@/lib/domain/schedule/suggestions";
import type { SlotFieldName } from "@/lib/validation/slotFields";

/**
 * The ids of the three `<datalist>`s a lesson form's inputs point at.
 *
 * Fixed rather than generated, because the lists are rendered once per screen
 * and every input of every day form on it refers to the same three: the
 * template editor draws seven forms of up to ten rows each, and a list per
 * input would send the same options seventy times.
 */
const SUGGESTION_LIST_IDS = {
  subject: "lesson-suggestions-subject",
  className: "lesson-suggestions-class-name",
  teacherName: "lesson-suggestions-teacher-name",
} as const;

/**
 * Which list each field of a lesson reads, or `undefined` for a field that
 * suggests nothing — a Zoom link and a note are not values a teacher retypes
 * (T-044). Every field is named, so a field added to `SLOT_FIELDS` cannot
 * compile without a decision here.
 */
const LIST_OF_FIELD: Record<SlotFieldName, string | undefined> = {
  ...SUGGESTION_LIST_IDS,
  zoomLink: undefined,
  note: undefined,
};

/** The `list` attribute for one field's input. */
export function suggestionListFor(field: SlotFieldName): string | undefined {
  return LIST_OF_FIELD[field];
}

/**
 * The three lists, as native `<datalist>` elements — overview §4.
 *
 * Native, so the suggestions work with JavaScript off like the rest of the
 * forms (ADR-005), and so they never constrain what is typed: a datalist
 * offers values, it does not validate against them. A screen renders this once,
 * beside its forms, from one `getLessonSuggestions()` read.
 */
export function SuggestionLists({
  suggestions,
}: {
  suggestions: LessonSuggestions;
}) {
  return (
    <>
      <SuggestionList
        id={SUGGESTION_LIST_IDS.subject}
        values={suggestions.subjects}
      />
      <SuggestionList
        id={SUGGESTION_LIST_IDS.className}
        values={suggestions.classNames}
      />
      <SuggestionList
        id={SUGGESTION_LIST_IDS.teacherName}
        values={suggestions.teacherNames}
      />
    </>
  );
}

function SuggestionList({
  id,
  values,
}: {
  id: string;
  values: readonly string[];
}) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}
