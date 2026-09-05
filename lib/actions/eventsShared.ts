/**
 * What the event actions share — T-012.
 *
 * Constants only, and **no `"use server"` directive**, for the reason
 * `yearSetup.ts` states: a module with that directive may export nothing but
 * async functions, and every exported function under `lib/actions` must reach
 * `requireUser()` (`lib/auth/queryDiscipline.test.ts`). This file is imported
 * *by* the action module; it is not one.
 *
 * The messages are Ukrainian because a teacher reads them.
 */

/** The events screen — `app/(app)/(events)/events`. */
export const EVENTS_PATH = "/events";

/** The event is gone — deleted in another tab, or an invented id. */
export const EVENT_NOT_FOUND = "Подію не знайдено. Оновіть сторінку";

/**
 * An integrity violation nothing has better wording for
 * (`lib/db/constraintViolation.ts`).
 */
export const SAVE_REFUSED = "Не вдалося зберегти: дані суперечать іншим записам";

/**
 * A symbol that resolves to nothing usable, by the kind that was chosen — the
 * same three answers `weekdayRules.ts` gives, phrased for an event.
 *
 * It is not an error but a question the teacher has to answer: there are no
 * breaks entered after this date, no semester still running on it, or the
 * chosen last day is not after the event itself.
 */
export const UNRESOLVABLE_BOUNDARY = {
  NEXT_BREAK:
    "Після дати події немає канікул. Додайте канікули в налаштуваннях року або виберіть дату",
  END_OF_SEMESTER:
    "Немає семестру, який триває на дату події. Додайте семестри в налаштуваннях року або виберіть дату",
  DATE: "Останній день має бути пізніше за дату події",
};

/**
 * «до найближчих канікул» and «до кінця семестру» are resolved against the
 * `AcademicYear` the event falls in (overview §8.1), and an event may be dated
 * outside every year the teacher has set up — the events screen deliberately
 * does not confine one to a year (schema §4.10 gives `event` no
 * `academic_year_id`).
 */
export const NO_YEAR_FOR_THE_DATE =
  "На дату події ще не налаштований навчальний рік, тож канікули й семестри невідомі. Виберіть «до дати» або спершу задайте рік";
