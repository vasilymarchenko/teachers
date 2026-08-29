import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";
import type { Parity, ScheduleView } from "@/lib/db/schema/enums";
import type { CalendarViewName } from "@/lib/domain/calendar/views";
import type { IsoDate } from "@/lib/time/today";

/**
 * Every word the calendar shows the teacher — Ukrainian, because she reads it
 * (root `CLAUDE.md`). The screens hold no literal text of their own, so the
 * wording is changed here and nowhere else.
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
