/**
 * What the six year-setup action modules share — T-009.
 *
 * Constants only, and **no `"use server"` directive**: a module with that
 * directive may export nothing but async functions, and every exported function
 * under `lib/actions` must reach `requireUser()`
 * (`lib/auth/queryDiscipline.test.ts`). This file is imported *by* the action
 * modules, it is not one.
 *
 * The messages are Ukrainian because a teacher reads them, and they are the
 * ones no single form owns: a constraint the database refused, a year that
 * disappeared between rendering the form and submitting it.
 */

/** The screen every year-setup action revalidates — `app/(app)/(schedule)/year`. */
export const YEAR_SETUP_PATH = "/year";

/**
 * An integrity violation nothing has better wording for
 * (`lib/db/constraintViolation.ts`). It says the save did not happen, which is
 * the part the teacher needs; the specifics are in the logs.
 */
export const SAVE_REFUSED = "Не вдалося зберегти: дані суперечать іншим записам";

/** The selected year is gone — deleted in another tab, or an invented id. */
export const YEAR_NOT_FOUND = "Навчальний рік не знайдено. Оновіть сторінку";

/** A child range that leaves the year it belongs to. */
export const OUTSIDE_THE_YEAR = "Дати мають бути в межах навчального року";
