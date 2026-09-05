import { describe, expect, it } from "vitest";
import { deadlineInput, infoEventInput } from "./event";

/**
 * The two event schemas — the shapes `event`'s check constraints hold, said in
 * the form so that the teacher meets them as a sentence rather than as a
 * refused save (schema §4.10).
 */

const deadline = (fields: Record<string, string> = {}) => ({
  title: "Здати звіт",
  note: "",
  dateFrom: "2026-10-15",
  ...fields,
});

const infoEvent = (fields: Record<string, string> = {}) => ({
  title: "День золотої рибки",
  note: "",
  dateFrom: "2026-09-13",
  dateTo: "",
  recurrenceKind: "NONE",
  boundaryKind: "",
  lastDay: "",
  ...fields,
});

/** The first message on a field, as `invalidInput()` would keep it. */
function errorOn(
  result: { success: boolean; error?: { issues: readonly { path: PropertyKey[]; message: string }[] } },
  field: string,
): string | undefined {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("завдання з терміном", () => {
  it("accepts a title and a due date", () => {
    const result = deadlineInput.safeParse(deadline());

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: "Здати звіт",
      note: undefined,
      dateFrom: "2026-10-15",
    });
  });

  it("keeps the note when there is one", () => {
    const parsed = deadlineInput.parse(deadline({ note: "  за І семестр  " }));

    expect(parsed.note).toBe("за І семестр");
  });

  it("refuses an empty title", () => {
    expect(errorOn(deadlineInput.safeParse(deadline({ title: " " })), "title")).toBe(
      "Введіть назву",
    );
  });

  it("refuses a missing date", () => {
    expect(
      errorOn(deadlineInput.safeParse(deadline({ dateFrom: "" })), "dateFrom"),
    ).toBe("Виберіть дату, до якої треба виконати");
  });

  it("has no repetition to submit at all (overview §4)", () => {
    // `z.object()` strips what it does not know, so a hand-made request cannot
    // smuggle a recurrence into a deadline.
    const parsed = deadlineInput.parse({
      ...deadline(),
      recurrenceKind: "WEEKLY",
      boundaryKind: "DATE",
    });

    expect(parsed).not.toHaveProperty("recurrenceKind");
  });
});

describe("інформаційна подія", () => {
  it("accepts a single day", () => {
    const parsed = infoEventInput.parse(infoEvent());

    expect(parsed).toEqual({
      title: "День золотої рибки",
      note: undefined,
      dateFrom: "2026-09-13",
      dateTo: undefined,
      recurrenceKind: "NONE",
      boundaryKind: undefined,
      lastDay: undefined,
    });
  });

  it("accepts a span of days", () => {
    const parsed = infoEventInput.parse(
      infoEvent({ dateFrom: "2026-10-26", dateTo: "2026-11-01" }),
    );

    expect(parsed.dateTo).toBe("2026-11-01");
  });

  it("refuses a span that ends before it starts", () => {
    const result = infoEventInput.safeParse(
      infoEvent({ dateFrom: "2026-10-26", dateTo: "2026-10-25" }),
    );

    expect(errorOn(result, "dateTo")).toBe(
      "Дата завершення не може бути раніша за дату початку",
    );
  });

  it("accepts a repetition with a symbolic boundary", () => {
    const parsed = infoEventInput.parse(
      infoEvent({ recurrenceKind: "WEEKLY", boundaryKind: "NEXT_BREAK" }),
    );

    expect(parsed.recurrenceKind).toBe("WEEKLY");
    expect(parsed.boundaryKind).toBe("NEXT_BREAK");
    // Nothing is resolved here: `boundaryDate` is the action's answer, against
    // the year's breaks and semesters (overview §8.1).
    expect(parsed).not.toHaveProperty("boundaryDate");
  });

  it("refuses a repetition that also spans days (event_recurring_span_ck)", () => {
    const result = infoEventInput.safeParse(
      infoEvent({
        recurrenceKind: "WEEKLY",
        boundaryKind: "NEXT_BREAK",
        dateTo: "2026-09-15",
      }),
    );

    expect(errorOn(result, "dateTo")).toBe(
      "Подія, що повторюється, триває один день. Приберіть дату завершення або вимкніть повторення",
    );
  });

  it("refuses a repetition with no end (event_recurrence_ck)", () => {
    const result = infoEventInput.safeParse(infoEvent({ recurrenceKind: "YEARLY" }));

    expect(errorOn(result, "boundaryKind")).toBe("Виберіть, доки подія повторюється");
  });

  it("refuses «до дати Х» with no date", () => {
    const result = infoEventInput.safeParse(
      infoEvent({ recurrenceKind: "MONTHLY", boundaryKind: "DATE" }),
    );

    expect(errorOn(result, "lastDay")).toBe(
      "Виберіть останній день, коли подія ще повторюється",
    );
  });

  it("asks for no boundary when the event does not repeat", () => {
    expect(infoEventInput.safeParse(infoEvent()).success).toBe(true);
  });
});
