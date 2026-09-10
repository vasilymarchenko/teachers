/**
 * The layout of one lesson row, as classes — T-021.
 *
 * `LessonRow` is shared by every view (overview §10.2), and the space it gets
 * is decided by the card around it, not by the viewport: the week view's card
 * is the full width of a phone screen at 320 px and about a seventh of the work
 * area at `xl`, where the fixed number-and-time column leaves the subject name
 * nothing and the text paints outside the card. So the row reflows against its
 * **container**, not against a breakpoint — ADR-013.
 *
 * The threshold is the width below which the side-by-side form stops working:
 * `w-16` (64 px) for the number and its bell times, `gap-3` (12 px), and what
 * the longest subject of the seeded fixture needs beside them — «Інформатика»
 * measures about 95 px at `text-sm`. That is 171 px; `14rem` (224 px) is the
 * next size up with room for the «заміна» badge to sit on the same line.
 *
 * Exported as whole class strings rather than assembled from parts: Tailwind
 * finds the classes it has to generate by scanning the source for literals, so
 * an interpolated class name is a class that does not exist in the stylesheet.
 */
export const LESSON_ROW_LAYOUT = {
  /**
   * `DayLessons` — the container the row's `@max-[14rem]` variants resolve
   * against. Without it they never match and the row silently keeps the wide
   * form in a 95 px card, which is the defect T-021 describes.
   */
  container: "@container",

  /** The row: side by side, stacked in a narrow card. */
  row: "flex gap-3 @max-[14rem]:flex-col @max-[14rem]:gap-1",

  /**
   * The number and its bell times. A fixed 64 px column beside the payload;
   * in a narrow card one wrapping line above it, so the payload gets the whole
   * width instead of a fifth of it. `flex-wrap` is what keeps this line inside
   * a card narrower than the line itself.
   */
  timeColumn:
    "flex w-16 shrink-0 flex-col text-sm @max-[14rem]:w-auto @max-[14rem]:flex-row @max-[14rem]:flex-wrap @max-[14rem]:items-baseline @max-[14rem]:gap-x-1.5",

  /**
   * The payload side. `min-w-0` lets it shrink inside the flex row and
   * `break-words` is what makes the shrinking honest: without it the box
   * narrows and the text keeps its own width, which is how a subject name ends
   * up over the neighbouring day.
   */
  payload: "min-w-0 flex-1 space-y-1 break-words",

  /** The subject name — wraps inside the payload column, never past it. */
  subject: "min-w-0 break-words",

  /** The en dash between the two bell times, on the line they share. */
  timeSeparator: "hidden @max-[14rem]:inline",
} as const;
