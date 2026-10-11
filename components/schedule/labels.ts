import type { Parity, ScheduleView, Weekday } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { slotFieldLabel } from "@/components/forms/slot-labels";
import type { SlotFieldName } from "@/lib/validation/slotFields";
import type { LessonRow } from "./lessonRows";

/**
 * Every word the weekly template editor shows the teacher — Ukrainian, because
 * she reads it (root `CLAUDE.md`, language by audience). The components below
 * hold no literal text of their own.
 *
 * The words this screen shares with another are imported rather than written
 * again: «Мої уроки» / «Уроки класу» is the switch of specification §6.2 and
 * belongs to the calendar's labels, the weekdays and the boundary kinds belong
 * to the year setup's, and a date the teacher reads has one format in the whole
 * application. A second wording of a product term is how one term becomes two.
 */

import { fullDate, SCHEDULE_LABELS } from "@/components/calendar/labels";
import { PARITY_OPTION_LABELS } from "@/components/year/labels";

export { SCHEDULE_LABELS, capitalise, fullDate } from "@/components/calendar/labels";
export {
  ACTION_LABELS,
  BOUNDARY_KIND_LABELS,
  BOUNDARY_KIND_OPTIONS,
  PARITY_OPTION_LABELS,
  WEEKDAY_LABELS,
} from "@/components/year/labels";

/** The page itself — specification §5.1 and §5.2. */
export const PAGE_LABELS = {
  title: "Тижневий розклад",
  intro:
    "Тижневий шаблон заповнюється окремо для тижня-чисельника і тижня-знаменника та окремо для своїх уроків і уроків класу. Зміни діють від сьогодні й уперед.",
  parityLabel: "Тиждень",
  viewLabel: "Розклад",
  dayLabel: "День тижня",
  toYear: "Налаштування навчального року",
  toCalendar: "Перейти до календаря",
};

/** What the screen says when the bell schedule is still empty. */
export const NO_BELLS = {
  title: "Спершу заповніть розклад дзвінків",
  description:
    "Номери уроків і час їх початку беруться з розкладу дзвінків. Без нього невідомо, скільки уроків має навчальний день.",
  link: "Заповнити розклад дзвінків",
};

/** The day card and its inputs. */
export const DAY_LABELS = {
  /** Each input names its own lesson: a screen reader otherwise hears
      «Предмет» ten times down one column. */
  field: (lessonNumber: number, field: SlotFieldName): string =>
    slotFieldLabel(lessonNumber, field),
  empty: "Уроків на цей день немає — заповніть будь-який рядок і збережіть.",
};

/** «3 · 10:15» — specification §5.1 asks for the number and the start time. */
export function lessonRowLabel(row: LessonRow): string {
  return row.timeFrom === undefined
    ? `${row.lessonNumber}`
    : `${row.lessonNumber} · ${row.timeFrom}`;
}

/**
 * The icon at the end of a row's header (T-046): its accessible name and its
 * hover hint, naming the lesson — seven «Очистити» on one screen would not say
 * which.
 */
export const ROW_ACTION_LABELS = {
  clear: (lessonNumber: number) => `Очистити урок ${lessonNumber}`,
  undo: (lessonNumber: number) => `Відновити урок ${lessonNumber}`,
};

/**
 * The other parity week, in the grammatical forms the sentences below need —
 * «у знаменник», «у знаменнику», «зі знаменника».
 */
const OTHER_WEEK: Record<
  Parity,
  { name: string; into: string; at: string; from: string }
> = {
  NUMERATOR: {
    name: "Чисельник",
    into: "чисельник",
    at: "у чисельнику",
    from: "з чисельника",
  },
  DENOMINATOR: {
    name: "Знаменник",
    into: "знаменник",
    at: "у знаменнику",
    from: "зі знаменника",
  },
};

/**
 * A row's «в обох тижнях» toggle and the line under its header (T-043,
 * ADR-025, glossary §3). `other` is always the parity week that is **not** on
 * the screen: the one the toggle writes into.
 */
export const BOTH_WEEKS_LABELS = {
  /** The toggle's accessible name and hover hint, naming the lesson. */
  toggle: (lessonNumber: number) => `Урок ${lessonNumber} — в обох тижнях`,
  /** The words beside the icon on the one-day view. */
  short: "в обох тижнях",
  /** Toggle off, the row differs: what the other week has there. */
  otherHas: (other: Parity, lesson: string) => `${OTHER_WEEK[other].name}: ${lesson}`,
  otherEmpty: (other: Parity) => `${OTHER_WEEK[other].name}: уроку немає`,
  /** Toggle on: what the save will do in the other week. */
  willAdd: (other: Parity) => `додасть урок у ${OTHER_WEEK[other].into}`,
  willReplace: (other: Parity, subject: string) =>
    `замінить «${subject}» ${OTHER_WEEK[other].at}`,
  willWrite: (other: Parity) => `зміни запишуться і в ${OTHER_WEEK[other].into}`,
  willRemove: (other: Parity, subject: string) =>
    `видалить «${subject}» ${OTHER_WEEK[other].from}`,
  /** After the save: the lessons it changed in the other week. */
  saved: (other: Parity, lessonNumbers: readonly number[]) =>
    `Також змінено ${OTHER_WEEK[other].at}: ${lessonNumbers
      .map((lessonNumber) => `урок ${lessonNumber}`)
      .join(", ")}`,
};

/** «Скопіювати з чисельника» — specification §5.1, glossary §3. */
export const COPY_LABELS: Record<Parity, string> = {
  NUMERATOR: "Скопіювати з чисельника у знаменник",
  DENOMINATOR: "Скопіювати зі знаменника у чисельник",
};

export const COPY_SECTION = {
  title: "Чисельник і знаменник",
  description:
    "Тижні зазвичай відрізняються лише кількома уроками. Скопіюйте один в інший і виправте те, що справді різниться.",
  confirm:
    "Скопіювати весь тиждень? Уроки тижня, у який копіюємо, буде замінено на уроки тижня, з якого копіюємо.",
  pending: "Копіюємо…",
};

/** The «доки діє» form — specification §5.1, overview §8.1. */
export const BOUNDARY_SECTION = {
  title: "Доки діє цей розклад",
  description:
    "За замовчуванням розклад діє до кінця поточного семестру. Можна натомість вказати конкретну дату або найближчі канікули.",
  boundaryKind: "Діє",
  lastDay: "Останній день дії",
  lastDayHint: "Потрібен лише для варіанта «До вибраної дати».",
  save: "Змінити межу",
  /** The same case as the weekday rule's `restated` (overview §8.1, T-047). */
  restated: (lastDay: IsoDate) =>
    `Дати канікул або семестру змінилися: після збереження розклад діятиме до ${fullDate(lastDay)}`,
};

/**
 * The version strip — what is in force, what it replaced and until when.
 *
 * The warning of invariant I2 is the one text on this screen that has to name
 * **three** dates: the last day the schedule in force will still cover, the day
 * it was going to run to, and the day the new one starts. After the save the
 * middle one no longer exists anywhere, so this is said before the teacher
 * saves, not after.
 */
export const VERSION_SECTION = {
  title: "Дія розкладу",
  description:
    "Кожна зміна діє від сьогодні. Попередній розклад залишається таким, яким був, — саме тому дні, що вже минули, не змінюються.",
  none: "Розклад на сьогодні не заданий. Перший збережений день почне діяти від сьогодні.",
  /** No full stop: the screen appends the boundary kind in brackets after it. */
  inForce: (validFrom: IsoDate, lastDay: IsoDate) =>
    `Чинний розклад: з ${fullDate(validFrom)} до ${fullDate(lastDay)}`,
  /**
   * Three dates, and they are three: the last day the schedule in force will
   * still cover (today − 1), the day it was going to run to, and the day the
   * new one starts (today, the cut of I1). Naming the cut as the start of the
   * new version is the whole claim — «зміни діють від сьогодні».
   */
  cutWarning: (cutAt: IsoDate, lastCoveredDay: IsoDate, lastDay: IsoDate) =>
    `Якщо зберегти зміну сьогодні, чинний розклад діятиме до ${fullDate(lastCoveredDay)} замість ${fullDate(lastDay)}, а від ${fullDate(cutAt)} почне діяти новий. Уже проведені дні залишаться такими, якими були.`,
  sameDay:
    "Чинний розклад почав діяти сьогодні — зміни ввійдуть у нього, нової версії не з’явиться.",
  historyTitle: "Попередні розклади",
  historyRow: (validFrom: IsoDate, lastDay: IsoDate) =>
    `з ${fullDate(validFrom)} до ${fullDate(lastDay)}`,
  future: "починає діяти пізніше",
  /**
   * The cap `capToNextVersion()` applies. Said before the save, like the
   * warning above, because it changes what «до кінця семестру» will mean.
   */
  cappedBy: (nextStart: IsoDate) =>
    `З ${fullDate(nextStart)} починає діяти наступний розклад, тому новий не діятиме довше, ніж до цієї дати.`,
};

/**
 * Editing a past day is not offered — specification §5.2 («історія не
 * переписується») and §5.3, which says where it is done instead.
 */
export const NO_BACKDATING = {
  text: "Змінити день, який уже минув, тут не можна: шаблон діє від сьогодні й уперед. Окремий день у минулому редагується в календарі — там правка стосується лише цієї дати.",
  link: "Відкрити календар",
};

/**
 * The weekday as the narrow screen's switcher shows it — «Пн», not a truncated
 * «П’ятниця». Two letters is what fits seven buttons across 390 px, and the
 * full name is still what the day's own heading says (`WEEKDAY_LABELS`).
 */
export const SHORT_WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "Пн",
  TUE: "Вт",
  WED: "Ср",
  THU: "Чт",
  FRI: "Пт",
  SAT: "Сб",
  SUN: "Нд",
};

/** The switch of specification §4, as a pair of links over the two weeks. */
export const PARITY_SWITCH_LABEL = "Тиждень-чисельник або тиждень-знаменник";
export const VIEW_SWITCH_LABEL = "Який розклад заповнюємо";
export const DAY_SWITCH_LABEL = "День тижня";

/**
 * The `aria-label` of one day's form. Seven forms on one screen say «Зберегти»
 * seven times, so each one names the day, the week and the schedule it saves.
 */
export function dayFormLabel(
  weekdayName: string,
  parity: Parity,
  view: ScheduleView,
): string {
  return `${weekdayName}, ${PARITY_OPTION_LABELS[parity].toLowerCase()}, ${SCHEDULE_LABELS[view].toLowerCase()}`;
}
