import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import { MonthCell, MonthDayRow } from "./views";

/**
 * The month view's click target — T-042.
 *
 * A day of the month is one link to the day view, and the link is the whole
 * day: on the grid the cell is the link, on a phone the card's link is
 * stretched over the card. What is pinned here is the markup the server sends —
 * the components are stateless and server-rendered, so the string is all there
 * is — and the count is of `<a` elements, because «one click target» is exactly
 * the claim a second link would break.
 *
 * The suite has no DOM (`vitest.config.mts`), so nothing here clicks; that the
 * stretched link covers the card is its classes' job and is read as such.
 */

function day(fields: Partial<CalendarDay>): CalendarDay {
  return {
    date: "2026-10-19",
    parity: "DENOMINATOR",
    isNonTeaching: false,
    lessons: [],
    cancelled: [],
    events: [],
    ...fields,
  };
}

const ownLesson = (lessonNumber: number) => ({
  lessonNumber,
  payload: { subject: "Математика", className: "7-А" },
  origin: "TEMPLATE" as const,
});

const ZOOM = "https://zoom.example/j/1";

const classLesson = (lessonNumber: number) => ({
  lessonNumber,
  payload: {
    subject: "Історія",
    teacherName: "Олена Петрівна",
    zoomLink: ZOOM,
  },
  origin: "TEMPLATE" as const,
  isTaughtByMe: false,
});

const deadline = {
  id: "event-1",
  kind: "DEADLINE" as const,
  title: "Здати журнал",
  note: null,
  done: false,
  isOverdue: true,
};

/** Every opening `<a …>` tag of the markup, in order. */
const anchors = (html: string) => html.match(/<a\b[^>]*>/g) ?? [];

const hrefOf = (anchor: string) => /href="([^"]*)"/.exec(anchor)?.[1];

/** A full day: a lesson, a cancelled lesson and an overdue deadline. */
const busyDay = day({
  lessons: [ownLesson(2)],
  cancelled: [ownLesson(1)],
  events: [deadline],
});

function cell(props: Partial<Parameters<typeof MonthCell>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(MonthCell, {
      day: busyDay,
      inMonth: true,
      schedule: "OWN",
      today: "2026-10-20",
      ...props,
    }),
  );
}

function row(props: Partial<Parameters<typeof MonthDayRow>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(MonthDayRow, {
      day: busyDay,
      schedule: "OWN",
      today: "2026-10-20",
      ...props,
    }),
  );
}

describe("a cell of the month grid", () => {
  it("is exactly one link, to the day view, and the link is the whole cell", () => {
    const html = cell();

    expect(anchors(html)).toHaveLength(1);
    expect(hrefOf(anchors(html)[0])).toBe("/calendar/day/2026-10-19");
    // Nothing is rendered beside the link: the lessons, the cancelled lesson
    // and the event are all inside it.
    expect(html.startsWith("<a")).toBe(true);
    expect(html.endsWith("</a>")).toBe(true);
    expect(html).toContain("Здати журнал");
  });

  it("keeps the CLASS schedule in the address", () => {
    expect(hrefOf(anchors(cell({ schedule: "CLASS" }))[0])).toBe(
      "/calendar/day/2026-10-19?schedule=class",
    );
  });

  it("is still one link on a day spilling in from a neighbouring month", () => {
    const html = cell({ day: day({ date: "2026-11-01" }), inMonth: false });

    expect(anchors(html)).toHaveLength(1);
    expect(hrefOf(anchors(html)[0])).toBe("/calendar/day/2026-11-01");
    expect(anchors(html)[0]).toContain("opacity-50");
  });

  it("names the link by its date, not by the bare number", () => {
    // 19 October 2026 is a Monday. The number the eye reads is hidden from
    // the accessible name; the date in words is what replaces it.
    const html = cell();

    expect(html).toContain('<span class="sr-only">понеділок, 19 жовтня</span>');
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>19<\/span>/);
  });

  it("keeps what the cell showed: today, the shading, the strikes, the overdue", () => {
    expect(anchors(cell({ today: "2026-10-19" }))[0]).toContain("ring-2");
    expect(anchors(cell({ today: "2026-10-20" }))[0]).not.toContain("ring-2");

    const holiday = cell({
      day: day({ isNonTeaching: true, nonTeachingName: "Осінні канікули" }),
    });
    expect(anchors(holiday)[0]).toContain("bg-muted/60");
    expect(holiday).toContain("Осінні канікули");

    const html = cell();
    expect(html).toMatch(/<li class="[^"]*line-through[^"]*">1 · Математика/);
    expect(html).toMatch(/<li class="[^"]*text-destructive[^"]*">◷ Здати журнал/);
  });
});

describe("a day of the phone's month list", () => {
  it("is exactly one link, to the day view, stretched over the card", () => {
    const html = row();

    expect(anchors(html)).toHaveLength(1);
    expect(hrefOf(anchors(html)[0])).toBe("/calendar/day/2026-10-19");
    expect(anchors(html)[0]).toContain("after:absolute");
    expect(anchors(html)[0]).toContain("after:inset-0");
    expect(html).toContain('<span class="sr-only">понеділок, 19 жовтня</span>');
  });

  it("leaves a lesson's Zoom link beside the day link, never inside it", () => {
    const html = row({
      day: day({ lessons: [classLesson(1)] }),
      schedule: "CLASS",
    });

    expect(anchors(html).map(hrefOf)).toEqual([
      "/calendar/day/2026-10-19?schedule=class",
      ZOOM,
    ]);
    // The day link closes before the Zoom link opens.
    const dayLinkEnd = html.indexOf("</a>");
    expect(dayLinkEnd).toBeGreaterThan(-1);
    expect(dayLinkEnd).toBeLessThan(html.indexOf(`href="${ZOOM}"`));
  });
});
