import { z } from "zod";

/**
 * The field builders the year-setup schemas share, and the two cross-field
 * rules that keep coming back.
 *
 * Every message is Ukrainian: a teacher reads it (root `CLAUDE.md`, language by
 * audience). They describe the *shape* of the input only — whether a semester
 * lies inside its year, or whether two years overlap, is decided by the action
 * and the database, and phrased there.
 */

const DATE_REQUIRED = "Виберіть дату";
const DATE_MALFORMED = "Дата має бути у форматі РРРР-ММ-ДД";

/**
 * An `IsoDate` as `<input type="date">` submits it — `YYYY-MM-DD`, and the empty
 * string when the teacher left it blank.
 *
 * `z.iso.date()` rejects a date that does not exist (`2027-02-30`), which is
 * what `lib/domain/schedule/dates.ts::isIsoDate()` does for a URL segment; both
 * ends of the application refuse the same thing.
 */
export const isoDateField = (required: string = DATE_REQUIRED) =>
  z.string(required).trim().min(1, required).pipe(z.iso.date(DATE_MALFORMED));

/**
 * A bell time as `<input type="time">` submits it — `HH:MM`, no seconds.
 *
 * `precision: -1` is what drops the seconds: `time_from`/`time_to` are `time`
 * columns with no date and no zone (overview §8.5), and `getBellSchedule()`
 * hands `HH:MM` back out again, so the string the teacher sees, the string the
 * form submits and the string the domain reads are one and the same.
 */
export const clockTimeField = z.iso.time({
  precision: -1,
  error: "Час має бути у форматі ГГ:ХХ",
});

/** Every entity range in the schema is inclusive at both ends (schema §6). */
export const DATE_RANGE_RULE = {
  message: "Дата завершення не може бути раніша за дату початку",
  path: ["dateTo"],
};

export const isOrderedRange = (range: {
  dateFrom: string;
  dateTo: string;
}): boolean => range.dateFrom <= range.dateTo;

/** Free text a teacher reads back — a period's name (schema §4.3). */
export const nameField = z
  .string()
  .trim()
  .min(1, "Введіть назву")
  .max(120, "Назва задовга — до 120 символів");

/**
 * A date the teacher may leave blank — «до дати Х» only asks for one when that
 * is the kind of boundary chosen. The empty string is kept rather than turned
 * into `undefined` here, so the schema that uses it can say which combination
 * of fields is actually missing.
 */
export const optionalIsoDateField = z.union([
  z.literal(""),
  z.iso.date(DATE_MALFORMED),
]);
