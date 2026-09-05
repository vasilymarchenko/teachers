import type { BoundaryKind, RecurrenceKind } from "@/lib/db/schema/enums";
import {
  BOUNDARY_KIND_VALUES,
  RECURRENCE_KIND_VALUES,
} from "@/lib/validation/enums";
import { dayAndMonth, fullDate } from "@/components/calendar/labels";
import { addIsoDays } from "@/lib/domain/schedule/dates";
import type { IsoDate } from "@/lib/time/today";

/**
 * Every word the events screen shows the teacher — Ukrainian, because she reads
 * it (root `CLAUDE.md`, language by audience). The components hold no literal
 * text of their own, exactly as the calendar's and the year setup's do not.
 *
 * The date formats are re-exported from the calendar's labels rather than
 * written again: a date the teacher reads has one format in the application.
 */

export type Option<Value extends string> = { value: Value; label: string };

const optionsFor = <Value extends string>(
  values: readonly Value[],
  labels: Record<Value, string>,
): Option<Value>[] => values.map((value) => ({ value, label: labels[value] }));

/** Glossary §5 — the two kinds of event, in the words the glossary binds. */
export const EVENT_KIND_LABELS = {
  DEADLINE: "Завдання з терміном",
  INFO: "Інформаційна подія",
};

/** Glossary §5 — `NONE` … `YEARLY`, as the teacher chooses them. */
export const RECURRENCE_LABELS: Record<RecurrenceKind, string> = {
  NONE: "Не повторюється",
  WEEKLY: "Щотижня",
  MONTHLY: "Щомісяця",
  YEARLY: "Щороку",
};

export const RECURRENCE_OPTIONS = optionsFor(
  RECURRENCE_KIND_VALUES,
  RECURRENCE_LABELS,
);

/** Glossary §4 — how the teacher said the repetition ends (overview §8.1). */
export const BOUNDARY_KIND_LABELS: Record<BoundaryKind, string> = {
  DATE: "До вибраної дати",
  NEXT_BREAK: "До найближчих канікул",
  END_OF_SEMESTER: "До кінця семестру",
};

export const BOUNDARY_KIND_OPTIONS = optionsFor(
  BOUNDARY_KIND_VALUES,
  BOUNDARY_KIND_LABELS,
);

export const PAGE_LABELS = {
  title: "Події",
  intro:
    "Завдання з терміном і те, що просто відбувається. Усе, що ви тут додасте, з’являється в календарі на своїх датах.",
};

export const DEADLINES_SECTION = {
  title: "Завдання з терміном",
  description:
    "Те, що треба зробити до дати. У календарі видно, чи виконано, а прострочені виділяються.",
  empty: "Завдань поки немає.",
  addTitle: "Додати завдання",
  removeConfirm: "Видалити це завдання? Воно зникне з календаря.",
};

export const INFO_SECTION = {
  title: "Інформаційні події",
  description:
    "Те, що просто відбувається: свята, тематичні дні, шкільні заходи. Може тривати кілька днів або повторюватися.",
  empty: "Подій поки немає.",
  addTitle: "Додати подію",
  removeConfirm: "Видалити цю подію? Вона зникне з календаря.",
};

/** The fields both forms share, and the ones only an information event has. */
export const EVENT_FORM = {
  title: "Назва",
  note: "Опис",
  deadlineDate: "Виконати до",
  dateFrom: "Дата",
  dateTo: "Останній день",
  dateToHint: "Якщо подія триває кілька днів. Для події, що повторюється, не заповнюється.",
  recurrenceKind: "Повторення",
  boundaryKind: "Доки повторюється",
  lastDay: "Останній день повторення",
  lastDayHint: "Потрібен, лише якщо вибрано «До вибраної дати».",
  /**
   * The teacher chooses a symbol and the application stores the date it means
   * today (overview §8.1). Saying so on the form is what keeps «до найближчих
   * канікул» from looking like a promise that follows the holidays if they move.
   */
  boundaryHint:
    "«До канікул» і «до кінця семестру» перетворюються на дату під час збереження. Якщо потім змінити дати канікул, повторення залишиться там, де його вже пораховано, — доки цю подію не збережуть ще раз: кожне збереження рахує межу наново.",
};

export const ACTION_LABELS = {
  add: "Додати",
  save: "Зберегти",
  saving: "Зберігаємо…",
  remove: "Видалити",
};

/** «виконано» / «ще не виконано» — the one state a deadline carries. */
export const DONE_LABELS = {
  done: "Виконано",
  notDone: "Ще не виконано",
  markDone: "Позначити виконаним",
  markNotDone: "Зняти позначку",
  marking: "Зберігаємо…",
};

/**
 * What one event says about when it happens — one line under its title in the
 * list.
 *
 * A repeating event names both halves of its boundary: the symbol the teacher
 * chose and the date it was resolved to (overview §8.1). Showing only the
 * symbol would hide that the date is already fixed; showing only the date would
 * lose what she asked for.
 */
export function eventSchedule(event: {
  dateFrom: IsoDate;
  dateTo: IsoDate | null;
  recurrenceKind: RecurrenceKind;
  boundaryDate: IsoDate | null;
  boundaryKind: BoundaryKind | null;
}): string {
  if (event.recurrenceKind !== "NONE") {
    const repetition = `${RECURRENCE_LABELS[event.recurrenceKind]} з ${dayAndMonth(event.dateFrom)}`;
    if (event.boundaryDate === null || event.boundaryKind === null) {
      return repetition;
    }
    // The stored bound is exclusive (§8.1), so the last day the event still
    // occurs on is the day before it — and that is the only form of it the
    // teacher ever sees, exactly as with a template's `validTo`.
    return `${repetition}, ${lowercase(BOUNDARY_KIND_LABELS[event.boundaryKind])} (востаннє до ${fullDate(addIsoDays(event.boundaryDate, -1))})`;
  }

  return event.dateTo === null || event.dateTo === event.dateFrom
    ? fullDate(event.dateFrom)
    : `${dayAndMonth(event.dateFrom)} — ${fullDate(event.dateTo)}`;
}

const lowercase = (text: string): string =>
  text.charAt(0).toLowerCase() + text.slice(1);
