import type { CalendarDay } from "@/lib/domain/calendar/days";
import { LessonRow } from "./lesson-row";

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
export function DayLessons({ day }: { day: CalendarDay }) {
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
          {day.nonTeachingName ?? "День без уроків"}
        </p>
      )}

      {rows.length === 0 ? (
        !day.isNonTeaching && (
          <p className="text-muted-foreground text-sm">Уроків немає</p>
        )
      ) : (
        <ul>
          {rows.map(({ lesson, cancelled }) => (
            <LessonRow
              cancelled={cancelled}
              key={`${cancelled ? "cancelled" : "lesson"}-${lesson.lessonNumber}`}
              lesson={lesson}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
