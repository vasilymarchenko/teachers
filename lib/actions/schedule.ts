/**
 * What the weekly template editor's actions share — T-010.
 *
 * Constants only, and **no `"use server"` directive**, for the reason
 * `yearSetup.ts` states: a module with that directive may export nothing but
 * async functions. This file is imported by an action module and by the screen;
 * it is not one.
 *
 * The messages are Ukrainian because a teacher reads them.
 */

/** The screen the template actions revalidate — `app/(app)/(schedule)/schedule`. */
export const SCHEDULE_PATH = "/schedule";

/**
 * An integrity violation nothing has better wording for
 * (`lib/db/constraintViolation.ts`).
 */
export const SAVE_REFUSED = "Не вдалося зберегти: дані суперечать іншим записам";

/**
 * The version this edit was planned against is not the one in the database any
 * more — another window saved first. Both the exclusion constraint (I3) and an
 * `UPDATE` that matched no rows surface as this.
 */
export const VERSION_CHANGED =
  "Розклад щойно змінили в іншому вікні. Оновіть сторінку й повторіть";

/** A symbolic boundary has nothing to resolve against until the year exists. */
export const NO_YEAR =
  "Спершу задайте навчальний рік — інакше немає від чого відлічувати межу дії розкладу";
