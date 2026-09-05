import { describe, expect, it } from "vitest";
import type { DateRange } from "@/lib/domain/schedule/types";
import { eventMarksByDate, type EventInput } from "./marks";

/**
 * The marks a calendar window hangs on its days, and the overdue rule of
 * specification §6.3. The expectations come from
 * `docs/architecture/design/T-012-events.md` §4 — the overdue table read
 * against «today» = 2026-10-19 — and not from running the code.
 */

const OCTOBER: DateRange = { from: "2026-10-01", to: "2026-10-31" };
const TODAY = "2026-10-19";

const deadline = (id: string, dateFrom: string, done: boolean): EventInput => ({
  id,
  kind: "DEADLINE",
  title: `Здати звіт ${id}`,
  note: null,
  done,
  dateFrom,
  dateTo: null,
  recurrenceKind: "NONE",
  boundaryDate: null,
});

const info = (id: string, dateFrom: string): EventInput => ({
  id,
  kind: "INFO",
  title: "День золотої рибки",
  note: null,
  done: null,
  dateFrom,
  dateTo: null,
  recurrenceKind: "NONE",
  boundaryDate: null,
});

describe("overdue deadlines", () => {
  it("marks a deadline whose date has passed and that is not done", () => {
    const marks = eventMarksByDate([deadline("d1", "2026-10-15", false)], OCTOBER, TODAY);

    expect(marks.get("2026-10-15")?.[0].isOverdue).toBe(true);
  });

  it("does not mark the same deadline once it is done", () => {
    const marks = eventMarksByDate([deadline("d1", "2026-10-15", true)], OCTOBER, TODAY);

    expect(marks.get("2026-10-15")?.[0].isOverdue).toBe(false);
  });

  it("does not mark one due today — it is due, not late", () => {
    const marks = eventMarksByDate([deadline("d1", TODAY, false)], OCTOBER, TODAY);

    expect(marks.get(TODAY)?.[0].isOverdue).toBe(false);
  });

  it("does not mark one still ahead", () => {
    const marks = eventMarksByDate([deadline("d1", "2026-10-22", false)], OCTOBER, TODAY);

    expect(marks.get("2026-10-22")?.[0].isOverdue).toBe(false);
  });

  it("never marks an INFO event, which has nothing to be late for", () => {
    const marks = eventMarksByDate([info("e1", "2026-10-15")], OCTOBER, TODAY);

    expect(marks.get("2026-10-15")).toEqual([
      {
        id: "e1",
        kind: "INFO",
        title: "День золотої рибки",
        note: null,
        done: null,
        isOverdue: false,
      },
    ]);
  });
});

describe("filing events under their dates", () => {
  it("puts a repeating event on each of its occurrences (W1)", () => {
    const weekly: EventInput = {
      ...info("e1", "2026-09-04"),
      recurrenceKind: "WEEKLY",
      boundaryDate: "2026-10-26",
    };

    const marks = eventMarksByDate([weekly], OCTOBER, TODAY);

    expect([...marks.keys()]).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
    ]);
  });

  it("keeps several events of one date in the order they arrived", () => {
    const marks = eventMarksByDate(
      [deadline("d1", "2026-10-15", false), info("e1", "2026-10-15")],
      OCTOBER,
      TODAY,
    );

    expect(marks.get("2026-10-15")?.map((mark) => mark.id)).toEqual(["d1", "e1"]);
  });

  it("holds no entry for a date nothing falls on", () => {
    const marks = eventMarksByDate([info("e1", "2026-10-15")], OCTOBER, TODAY);

    expect(marks.get("2026-10-16")).toBeUndefined();
  });
});
