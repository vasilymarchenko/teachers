import type { BellInput } from "./types";

/**
 * The lesson length behind the bell schedule — specification §3.3, glossary §1
 * (`lessonMinutes`).
 *
 * The teacher enters when each lesson starts and one length for all of them;
 * the end is computed here and stored in `BellSchedule.timeTo`, so a stored row
 * is a complete pair of times and nothing that reads one knows a length exists
 * (overview §9, «Кінець уроку зберігається, тривалість — лише поле форми»).
 *
 * Times are the `HH:MM` strings the rest of the domain passes around
 * (overview §8.5): no `Date`, no zone, and therefore no "today" to get wrong.
 */

/** What the form offers a teacher who has no bells yet — specification §3.3. */
export const DEFAULT_LESSON_MINUTES = 45;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOfDay(time: string): number | undefined {
  const match = CLOCK_TIME.exec(time);
  if (match === null) return undefined;
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

function clockTime(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;
}

/**
 * When a lesson that starts at `timeFrom` and lasts `lessonMinutes` ends.
 *
 * `undefined` when there is no such time on the same day: the start is not
 * `HH:MM`, the length is not a positive whole number, or the lesson would run
 * past 23:59. The last one is a refusal and not a wrap-around — a bell row has
 * no date, so `00:10` would be an end *before* its start, which
 * `bell_schedule_times_ck` rejects (schema §4.5).
 */
export function lessonEnd(
  timeFrom: string,
  lessonMinutes: number,
): string | undefined {
  const start = minutesOfDay(timeFrom);
  if (start === undefined) return undefined;
  if (!Number.isInteger(lessonMinutes) || lessonMinutes <= 0) return undefined;

  const end = start + lessonMinutes;
  return end < MINUTES_PER_DAY ? clockTime(end) : undefined;
}

/**
 * The lesson length the stored rows have, since the length itself is stored
 * nowhere: the length of the lowest-numbered row, and `DEFAULT_LESSON_MINUTES`
 * when there are no rows.
 *
 * `mixed` says the rows do not all share that length — rows written before the
 * form computed ends, or by the seed. The form then warns that saving gives
 * every lesson the one length it shows.
 */
export function storedLessonMinutes(bells: readonly BellInput[]): {
  lessonMinutes: number;
  mixed: boolean;
} {
  const lengths = [...bells]
    .sort((a, b) => a.lessonNumber - b.lessonNumber)
    .flatMap((bell) => {
      const start = minutesOfDay(bell.timeFrom);
      const end = minutesOfDay(bell.timeTo);
      return start === undefined || end === undefined ? [] : [end - start];
    });

  if (lengths.length === 0) {
    return { lessonMinutes: DEFAULT_LESSON_MINUTES, mixed: false };
  }

  const [lessonMinutes] = lengths;
  return {
    lessonMinutes,
    mixed: lengths.some((length) => length !== lessonMinutes),
  };
}
