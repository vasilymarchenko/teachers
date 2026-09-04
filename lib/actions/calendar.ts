/**
 * What the calendar's actions share — T-011.
 *
 * Constants only, and **no `"use server"` directive**, for the reason
 * `yearSetup.ts` states: a module with that directive may export nothing but
 * async functions. This file is imported by an action module and by the screen;
 * it is not one.
 *
 * The messages are Ukrainian because a teacher reads them.
 */

/**
 * The screen the override actions revalidate.
 *
 * The whole `/calendar` subtree, not one date: an override on 19 October is on
 * that day's page, in its week, in its month and in its year, and every one of
 * those URLs is a different path segment. The pages are `force-dynamic`
 * anyway — this is what keeps the Router Cache from handing back a stale
 * neighbouring view after the teacher navigates away.
 */
export const CALENDAR_PATH = "/calendar";

/**
 * An integrity violation nothing has better wording for
 * (`lib/db/constraintViolation.ts`).
 */
export const SAVE_REFUSED = "Не вдалося зберегти: дані суперечать іншим записам";

/** The override the screen was showing is not there any more. */
export const OVERRIDE_NOT_FOUND =
  "Цю правку вже прибрано в іншому вікні. Оновіть сторінку";
