import { lessonEnd } from "@/lib/domain/schedule/bells";
import type { BellInput } from "@/lib/domain/schedule/types";
import { parseLessonMinutes } from "@/lib/validation/bellSchedule";
import { LESSON_NUMBERS } from "@/lib/validation/enums";
import { clockTimeInput } from "@/lib/validation/fields";

/**
 * Whether saving the bell grid as it stands would write anything other than
 * the stored rows — the controlled form's own report to `TrackedForm` (T-047).
 *
 * Asked of what the save would **write**, not of what the inputs show: a start
 * typed `8:30` is the stored `08:30` (`clockTimeInput()`, as the action spells
 * it), and the lesson length is not a column at all — it changes the stored
 * rows only through the ends `lessonEnd()` computes from it. Which is also why
 * a grid whose stored rows do not share one length opens as changed: saving it
 * would rewrite every end to the one length the field shows.
 *
 * A length that does not parse is a change: the save would be refused with a
 * message, and the button that brings the message has to be available.
 */
export function bellGridChanged(
  bells: readonly BellInput[],
  lessonMinutes: string,
  starts: Readonly<Record<number, string>>,
): boolean {
  const minutes = parseLessonMinutes(lessonMinutes);
  if (minutes === undefined) return true;

  return LESSON_NUMBERS.some((lessonNumber) => {
    const start = clockTimeInput(starts[lessonNumber] ?? "");
    const stored = bells.find((bell) => bell.lessonNumber === lessonNumber);
    if (start === "") return stored !== undefined;

    return (
      stored === undefined ||
      stored.timeFrom !== start ||
      stored.timeTo !== lessonEnd(start, minutes)
    );
  });
}
