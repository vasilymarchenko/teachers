import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";
import type {
  DayOverrideKind,
  Parity,
  ScheduleView,
} from "@/lib/db/schema/enums";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import type { CalendarViewName } from "@/lib/domain/calendar/views";
import type { IsoDate } from "@/lib/time/today";
import type { EditableOverrideKind } from "@/lib/validation/dayOverride";

/**
 * Every word the calendar shows the teacher — Ukrainian, because she reads it
 * (root `CLAUDE.md`). The components hold no literal text of their own: a word
 * is reworded here and nowhere else, and it changes everywhere it appears.
 *
 * Dates are formatted with the `uk` locale of `date-fns`: «19 жовтня 2026»,
 * «понеділок» — never a bare `Date` and never `new Date()` (overview §8.5).
 */

const on = (date: IsoDate) => parseISO(date);

/** «19 жовтня 2026 р.» */
export function fullDate(date: IsoDate): string {
  return format(on(date), "d MMMM yyyy 'р.'", { locale: uk });
}

/** «19 жовтня» — inside a view whose title already carries the year. */
export function dayAndMonth(date: IsoDate): string {
  return format(on(date), "d MMMM", { locale: uk });
}

/** «понеділок» */
export function weekdayName(date: IsoDate): string {
  return format(on(date), "EEEE", { locale: uk });
}

/** «пн» — the column heading of the week and month grids. */
export function shortWeekdayName(date: IsoDate): string {
  return format(on(date), "EEEEEE", { locale: uk });
}

/** «19» — the day number in a month or year cell. */
export function dayNumber(date: IsoDate): string {
  return format(on(date), "d", { locale: uk });
}

/** «жовтень 2026» */
export function monthAndYear(date: IsoDate): string {
  return format(on(date), "LLLL yyyy", { locale: uk });
}

/** «Жовтень» — the heading of one month inside the year view. */
export function monthName(date: IsoDate): string {
  const name = format(on(date), "LLLL", { locale: uk });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The title above a view — what period the teacher is looking at. */
export function periodTitle(
  view: CalendarViewName,
  date: IsoDate,
  range: { from: IsoDate; to: IsoDate },
  /** `false` when no `AcademicYear` covers the date — the range is then a
      calendar year, and calling it a school year would be a lie. */
  hasAcademicYear = false,
): string {
  switch (view) {
    case "day":
      return `${capitalise(weekdayName(date))}, ${fullDate(date)}`;
    case "week":
      return `Тиждень ${dayAndMonth(range.from)} — ${fullDate(range.to)}`;
    case "month":
      return capitalise(monthAndYear(date));
    case "year":
      return hasAcademicYear
        ? `Навчальний рік: ${fullDate(range.from)} — ${fullDate(range.to)}`
        : `Рік: ${fullDate(range.from)} — ${fullDate(range.to)}`;
  }
}

/** The four views, as the switch names them (specification §6.1). */
export const VIEW_LABELS: Record<CalendarViewName, string> = {
  day: "День",
  week: "Тиждень",
  month: "Місяць",
  year: "Рік",
};

/** The ← → links, named for what they move (specification §6.1). */
export const PREVIOUS_LABELS: Record<CalendarViewName, string> = {
  day: "Попередній день",
  week: "Попередній тиждень",
  month: "Попередній місяць",
  year: "Попередній рік",
};

export const NEXT_LABELS: Record<CalendarViewName, string> = {
  day: "Наступний день",
  week: "Наступний тиждень",
  month: "Наступний місяць",
  year: "Наступний рік",
};

/** The switch of specification §6.2. */
export const SCHEDULE_LABELS: Record<ScheduleView, string> = {
  OWN: "Мої уроки",
  CLASS: "Уроки класу",
};

/** Week parity — glossary §2. */
export const PARITY_LABELS: Record<Parity, string> = {
  NUMERATOR: "чисельник",
  DENOMINATOR: "знаменник",
};

/** «понеділок» → «Понеділок» — the `uk` locale gives lower-case names. */
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The badges and links on one lesson row (specification §5.1, §5.3, §5.4). */
export const LESSON_LABELS = {
  cancelled: "скасовано",
  edit: "правка",
  substitution: "заміна",
  taughtByMe: "веду я",
  zoomLink: "Посилання на Zoom",
};

/** What a day says about itself when it has no lessons to show. */
export const DAY_LABELS = {
  /** A teaching day with nothing planned. */
  noLessons: "Уроків немає",
  /** Non-teaching by a `NonTeachingWeekdayRule`, which has no name to give. */
  unnamedNonTeaching: "День без уроків",
  today: "сьогодні",
};

/** The controls of specification §6.1 and §6.2, labels and `aria-label`s. */
export const NAV_LABELS = {
  today: "Сьогодні",
  viewSwitch: "Вид календаря",
  scheduleSwitch: "Розклад",
  quickJumps: "Швидкі переходи",
  wholeYear: "Весь навчальний рік",
  /** §6.1 names this jump «до вересня» — the honest name of a year that does
      not begin in September is the same jump under another word. */
  toSeptember: "До вересня",
  toYearStart: "На початок року",
  yearEnd: "Кінець навчального року",
};

/** Shown when no `AcademicYear` covers the date — before T-009 has been run. */
export const YEAR_NOT_SET_UP = {
  before: "Навчальний рік ще не налаштований — ",
  link: "задайте його межі, канікули та дзвінки",
  after: ".",
};

/**
 * What a year-view cell says on hover, since it shows only a number.
 *
 * The cancelled lessons are counted here too: a day whose only lesson a
 * `CLEARED` override removed must not read as a free day (specification §5.3),
 * and in the year grid the tooltip is most of what the cell can say.
 */
export function dayTooltip(day: CalendarDay): string {
  const parts: string[] = [];

  if (day.isNonTeaching && day.nonTeachingName !== undefined) {
    parts.push(day.nonTeachingName);
  } else {
    parts.push(
      day.lessons.length === 0
        ? "уроків немає"
        : `уроків: ${day.lessons.length}`,
    );
  }
  if (day.cancelled.length > 0) {
    parts.push(`${LESSON_LABELS.cancelled}: ${day.cancelled.length}`);
  }

  return `${dayAndMonth(day.date)} — ${parts.join(" · ")}`;
}

/** The edit affordances on a day — specification §5.3, T-011. */
export const EDIT_LABELS = {
  /** On a lesson row; the row above it already says which lesson it is. */
  edit: "Змінити",
  editLesson: (lessonNumber: number) => `Змінити урок ${lessonNumber}`,
  add: "Додати урок:",
  addLesson: (lessonNumber: number) => `Додати урок ${lessonNumber}`,
  /** Without bells there are no lesson numbers to add a lesson at. */
  noBells: "Щоб додати урок, спершу заповніть розклад дзвінків",
  toBells: "Розклад дзвінків",
};

/**
 * The override editor — specification §5.3 and §5.4, one lesson of one date.
 *
 * Three texts here carry a rule rather than a name, and each says out loud
 * something the model does that the teacher would otherwise have to guess:
 *
 *  - `intro` — an override changes this date and nothing else (§5.4);
 *  - `substitutionHint` — the lesson shown under a «заміна» is taken from the
 *    weekly schedule in force **on that date**, so a later change to the
 *    schedule changes it. That is accepted behaviour (overview §3.4), and the
 *    screen may not imply otherwise by staying silent about it;
 *  - `clearHint` — «скасувати» leaves the lesson visible and struck through,
 *    which is what makes it different from «прибрати правку».
 */
export const OVERRIDE_LABELS = {
  title: (lessonNumber: number, date: IsoDate) =>
    `Урок ${lessonNumber} — ${capitalise(weekdayName(date))}, ${fullDate(date)}`,
  intro:
    "Зміни на цій сторінці стосуються лише цієї дати. Тижневий розклад та інші дні залишаються без змін.",
  back: "Повернутися до календаря",

  currentTitle: "Зараз у календарі",
  currentNone: "На цей номер уроку в календарі нічого немає.",

  plannedTitle: "За тижневим розкладом",
  plannedDescription:
    "Те, що буде на цьому уроці, якщо не робити жодних змін на цю дату.",
  plannedNone: "Тижневий розклад на цей номер уроку нічого не дає.",

  formTitle: "Що поставити на цю дату",
  formDescription:
    "Заповніть урок і збережіть — запис діятиме лише на цю дату.",
  kindLabel: "Тип запису",
  substitutionHint:
    "Замінений урок береться з того тижневого розкладу, який діє на цю дату, і не зберігається разом із заміною. Якщо розклад згодом зміниться, поруч із заміною буде вже інший урок — сама заміна залишиться на місці.",
  save: "Зберегти",
  saving: "Зберігаємо…",

  clear: "Скасувати урок",
  clearing: "Скасовуємо…",
  clearHint:
    "Скасований урок залишається видимим у календарі — закресленим, щоб було зрозуміло, що його не буде.",
  /**
   * Cancelling a slot that already carries an override replaces it with a
   * tombstone: the text the teacher typed is overwritten and nothing on the
   * screen brings it back. `clearHint` alone would let her press the button
   * believing otherwise.
   */
  clearOverwritesHint:
    "Скасований урок залишається видимим у календарі — закресленим. Але те, що ви вписали на цю дату, буде втрачено: після скасування повернути можна лише урок із тижневого розкладу.",
  clearConfirm:
    "Скасувати урок? Те, що ви вписали на цю дату, буде втрачено — повернути його не вийде.",

  removeConfirm:
    "Прибрати цей запис? На цю дату знову діятиме тижневий розклад.",
  removeHint:
    "Якщо прибрати запис, на цю дату повернеться урок із тижневого розкладу.",
  /**
   * The slot has no lesson in the weekly template — the override was written
   * through «Додати урок». Removing it leaves the date empty, so the wording
   * may not promise a lesson that would come back.
   */
  removeConfirmNoPlanned:
    "Прибрати цей запис? Тижневий розклад на цей урок нічого не дає, тож на цю дату уроку не залишиться.",
  removeHintNoPlanned:
    "Тижневий розклад на цей номер уроку нічого не дає, тож якщо прибрати запис, на цю дату уроку не залишиться.",
};

/** «Прибрати правку» — named after what is being removed (glossary §3). */
export const REMOVE_OVERRIDE_LABELS: Record<DayOverrideKind, string> = {
  EDIT: "Прибрати правку",
  SUBSTITUTION: "Прибрати заміну",
  CLEARED: "Повернути урок",
};

/**
 * The choice between «правка» and «заміна» — the one field only an override
 * has (overview §3.4). The difference is not what is stored but what the
 * calendar shows beside it, so each option says that and nothing else.
 */
export const OVERRIDE_KIND_OPTIONS: readonly {
  value: EditableOverrideKind;
  label: string;
  description: string;
}[] = [
  {
    value: "EDIT",
    label: "Правка",
    description: "Просто інший урок цього дня.",
  },
  {
    value: "SUBSTITUTION",
    label: "Заміна",
    description: "Те саме, але поруч буде видно, який урок замінено.",
  },
];
