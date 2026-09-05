import Link from "next/link";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import type { CalendarViewName } from "@/lib/domain/calendar/views";
import type { BellInput } from "@/lib/domain/schedule/types";
import { DAY_LABELS, EDIT_LABELS } from "./labels";
import { addableLessonNumbers } from "./lessonNumbers";
import { LessonRow } from "./lesson-row";
import { lessonHref } from "./links";

/**
 * What a day needs in order to be edited from where it is shown — T-011,
 * specification §5.3 («відредагувати вручну прямо з календаря»).
 *
 * `view` is the calendar view the links are being rendered in, so that
 * «Повернутися» takes the teacher back to it and not to a view she was not
 * looking at. `bells` is where the lesson numbers to add a lesson at come from
 * — the same source the template editor's rows come from (schema §4.5).
 *
 * Absent means the day is read-only: that is the month and year grids, whose
 * cells open the day instead.
 */
export type DayEditing = {
  view: CalendarViewName;
  schedule: ScheduleView;
  bells: readonly BellInput[];
};

/**
 * The lessons of one day — the shared component of overview §10.2.
 *
 * The day is the unit the calendar is built from: at phone width the week and
 * the month show these lists one under another, and the grid appears only from
 * tablet width up. That is the decision of Q-002, and it is why this component
 * exists before any grid does.
 *
 * The four states a day can be in are visibly different (fixtures §8.7):
 *
 * - lessons — the ordinary day;
 * - non-teaching, named — «Осінні канікули», shaded;
 * - a teaching day whose lessons were all cancelled — the cancelled lessons
 *   are shown struck through, not omitted;
 * - a teaching day with nothing planned — «Уроків немає».
 */
export function DayLessons({
  day,
  editing,
}: {
  day: CalendarDay;
  editing?: DayEditing;
}) {
  // Cancelled lessons sit at their own `lessonNumber`, not in a list of their
  // own after the day: the fourth lesson was cancelled, so the gap between the
  // third and the fifth is where the teacher expects to see it.
  const rows = [
    ...day.lessons.map((lesson) => ({ lesson, cancelled: false })),
    ...day.cancelled.map((lesson) => ({ lesson, cancelled: true })),
  ].sort((a, b) => a.lesson.lessonNumber - b.lesson.lessonNumber);

  return (
    <div className="space-y-2">
      {day.isNonTeaching && (
        <p className="text-muted-foreground text-sm">
          {day.nonTeachingName ?? DAY_LABELS.unnamedNonTeaching}
        </p>
      )}

      {rows.length === 0 ? (
        !day.isNonTeaching && (
          <p className="text-muted-foreground text-sm">
            {DAY_LABELS.noLessons}
          </p>
        )
      ) : (
        <ul>
          {rows.map(({ lesson, cancelled }) => (
            <LessonRow
              cancelled={cancelled}
              editHref={
                editing &&
                lessonHref(
                  editing.view,
                  day.date,
                  lesson.lessonNumber,
                  editing.schedule,
                )
              }
              key={`${cancelled ? "cancelled" : "lesson"}-${lesson.lessonNumber}`}
              lesson={lesson}
            />
          ))}
        </ul>
      )}

      {editing !== undefined && <AddLesson day={day} editing={editing} />}
    </div>
  );
}

/**
 * «Додати урок: + 3 + 4» — how an override is created where the template has
 * nothing.
 *
 * It is offered on **every** day the calendar shows, a non-teaching one
 * included: `isNonTeaching` suppresses lessons of `origin = TEMPLATE` and
 * nothing else, so a day of the autumn break may legitimately carry the
 * Saturday make-up lesson the teacher writes in by hand (overview §3.4,
 * fixtures §8.7).
 *
 * Without a `BellSchedule` there are no lesson numbers to offer — the same
 * dead end the template editor has, answered with the same pointer at the year
 * setup rather than with an invented list of ten. That pointer belongs to the
 * **screen**, not to the day: this component is rendered seven times by the
 * week view, and a freshly set-up account would meet seven identical copies of
 * one notice with seven links to `/year`. The calendar page says it once, above
 * the views, the way it already says that the year is not set up.
 */
function AddLesson({ day, editing }: { day: CalendarDay; editing: DayEditing }) {
  if (editing.bells.length === 0) return null;

  const numbers = addableLessonNumbers(day, editing.bells);
  if (numbers.length === 0) return null;

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {EDIT_LABELS.add}
      {numbers.map((lessonNumber) => (
        <Link
          className="hover:text-foreground underline underline-offset-2"
          href={lessonHref(
            editing.view,
            day.date,
            lessonNumber,
            editing.schedule,
          )}
          key={lessonNumber}
        >
          <span aria-hidden>{lessonNumber}</span>
          <span className="sr-only">{EDIT_LABELS.addLesson(lessonNumber)}</span>
        </Link>
      ))}
    </p>
  );
}
