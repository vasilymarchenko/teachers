import Link from "next/link";
import type { ResolvedLesson } from "@/lib/domain/schedule/types";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import { cn } from "@/lib/utils";
import { EDIT_LABELS, LESSON_LABELS } from "./labels";

/**
 * One lesson, as specification §5.1 lists its fields and §5.4 wants a
 * substitution shown.
 *
 * The number and its bell time are the row's left edge — «3 · 10:15» of §5.1 —
 * and the payload's own fields follow, which is the only place the two views
 * differ in what they render. A lesson with no `BellSchedule` row for its
 * number simply shows no time: the key is absent, not empty
 * (`expand-fixtures.md` §8.8).
 */

/**
 * `http(s)` only. `zoomLink` is free text the teacher typed, checked by
 * `z.url()` (`lib/validation/slotPayload.ts`), and a URL parser accepts
 * schemes an `href` must never carry.
 */
function isWebLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** `OWN` payloads carry a class, `CLASS` payloads carry a teacher. */
function isOwnPayload(
  payload: SlotPayload,
): payload is Extract<SlotPayload, { className: string }> {
  return "className" in payload;
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "destructive";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs leading-5 whitespace-nowrap",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "destructive" && "bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

/** The payload's own fields, one line each. */
function PayloadBody({ payload }: { payload: SlotPayload }) {
  if (isOwnPayload(payload)) {
    return <p className="text-muted-foreground text-sm">{payload.className}</p>;
  }

  return (
    <div className="text-muted-foreground space-y-0.5 text-sm">
      <p>{payload.teacherName}</p>
      {payload.zoomLink !== undefined &&
        (isWebLink(payload.zoomLink) ? (
          <p>
            <a
              className="text-primary underline underline-offset-2"
              href={payload.zoomLink}
              rel="noreferrer noopener"
              target="_blank"
            >
              {LESSON_LABELS.zoomLink}
            </a>
          </p>
        ) : (
          // Not a link the browser should follow: shown as text, so a stored
          // `javascript:` or `data:` URL cannot become a clickable `href`.
          <p className="break-all">{payload.zoomLink}</p>
        ))}
      {payload.note !== undefined && <p>{payload.note}</p>}
    </div>
  );
}

/** «Математика · 7-А» — the one-line form, for the lesson a substitution displaced. */
function payloadSummary(payload: SlotPayload): string {
  return isOwnPayload(payload)
    ? `${payload.subject} · ${payload.className}`
    : `${payload.subject} · ${payload.teacherName}`;
}

export function LessonRow({
  lesson,
  cancelled = false,
  editHref,
}: {
  lesson: ResolvedLesson;
  /**
   * A lesson a `CLEARED` override took off this date. It renders struck
   * through rather than disappearing, so that the teacher sees a cancelled
   * lesson and not a shorter day (specification §5.3).
   */
  cancelled?: boolean;
  /**
   * The override editor of this lesson (T-011). Present in the day and week
   * views, where specification §5.3 starts the edit «прямо з календаря»;
   * absent in the month and year cells, which are too small to carry a second
   * link per lesson and whose day number already opens the day.
   *
   * A cancelled row carries it too — that is where the cancellation is undone.
   */
  editHref?: string;
}) {
  return (
    <li
      className={cn(
        "border-border flex gap-3 border-b py-2 last:border-b-0",
        cancelled && "opacity-70",
      )}
    >
      <div className="w-16 shrink-0 text-sm">
        <p className="font-semibold">{lesson.lessonNumber}</p>
        {lesson.timeFrom !== undefined && lesson.timeTo !== undefined && (
          <p className="text-muted-foreground tabular-nums">
            {lesson.timeFrom}
            <br />
            {lesson.timeTo}
          </p>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "font-medium",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {lesson.payload.subject}
          </p>
          {cancelled && (
            <Badge tone="destructive">{LESSON_LABELS.cancelled}</Badge>
          )}
          {lesson.origin === "EDIT" && <Badge>{LESSON_LABELS.edit}</Badge>}
          {lesson.origin === "SUBSTITUTION" && (
            <Badge tone="accent">{LESSON_LABELS.substitution}</Badge>
          )}
          {/* `isTaughtByMe` is absent on a cancelled row by construction
              (`days.ts`), so this needs no `cancelled` guard of its own. */}
          {lesson.isTaughtByMe === true && (
            <Badge tone="accent">{LESSON_LABELS.taughtByMe}</Badge>
          )}
        </div>

        <PayloadBody payload={lesson.payload} />

        {/* §5.4: the planned lesson stays visible under the substitution, in
            small struck-through text, so it is clear what was replaced. */}
        {lesson.replacedOriginal !== undefined && (
          <p className="text-muted-foreground text-sm line-through">
            {payloadSummary(lesson.replacedOriginal)}
          </p>
        )}
      </div>

      {editHref !== undefined && (
        <Link
          className="text-muted-foreground hover:text-foreground shrink-0 self-start text-sm underline underline-offset-2"
          href={editHref}
        >
          <span aria-hidden>{EDIT_LABELS.edit}</span>
          <span className="sr-only">
            {EDIT_LABELS.editLesson(lesson.lessonNumber)}
          </span>
        </Link>
      )}
    </li>
  );
}
