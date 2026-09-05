import { describe, expect, it } from "vitest";
import { slotPayloadFor } from "./slotPayload";
import {
  readTemplateDay,
  templateDayFieldErrors,
  templateDayInputFor,
  templateSlotField,
  type TemplateDayRawEntry,
} from "./templateDay";

/**
 * The day form of T-010 — specification §5.1 and schema §4.8.
 *
 * The assertion that ties this file to the rest: every payload the schema
 * produces is parsed through `slotPayloadFor(view)`, which is the one place the
 * payload's shape is defined (schema §7). If the two ever disagree, this fails
 * rather than a `jsonb` column quietly taking the wrong shape.
 */

const row = (
  lessonNumber: number,
  fields: Partial<Omit<TemplateDayRawEntry, "lessonNumber">> = {},
): TemplateDayRawEntry => ({
  lessonNumber,
  subject: "",
  className: "",
  teacherName: "",
  zoomLink: "",
  note: "",
  ...fields,
});

describe("the OWN day", () => {
  const schema = templateDayInputFor("OWN");

  it("keeps a filled row as a slot payload", () => {
    const parsed = schema.safeParse({
      entries: [row(1, { subject: "Математика", className: "7-А" })],
    });

    expect(parsed.success && parsed.data.entries).toEqual([
      { lessonNumber: 1, payload: { subject: "Математика", className: "7-А" } },
    ]);
  });

  it("treats an empty row as no slot", () => {
    // Schema §4.8: a slot exists only when the cell is filled, which is how a
    // cleared lesson is deleted by the same submission that saves the others.
    const parsed = schema.safeParse({ entries: [row(3)] });

    expect(parsed.success && parsed.data.entries).toEqual([{ lessonNumber: 3 }]);
  });

  it("demands the class once the subject is filled in", () => {
    const parsed = schema.safeParse({ entries: [row(1, { subject: "Математика" })] });

    expect(parsed.success).toBe(false);
    expect(
      !parsed.success && templateDayFieldErrors(parsed.error, [1]),
    ).toEqual({ [templateSlotField(1, "className")]: "Вкажіть клас" });
  });

  it("ignores the fields of the other view", () => {
    // `z.object()` keeps the six raw keys, but only the view's own reach the
    // payload — the OWN payload has no `teacherName` to smuggle one into.
    const parsed = schema.safeParse({
      entries: [
        row(1, { subject: "Математика", className: "7-А", teacherName: "Хтось" }),
      ],
    });

    expect(parsed.success && parsed.data.entries[0].payload).toEqual({
      subject: "Математика",
      className: "7-А",
    });
  });

  it("refuses a subject longer than the column is meant to hold", () => {
    const parsed = schema.safeParse({
      entries: [row(1, { subject: "я".repeat(121), className: "7-А" })],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("the CLASS day", () => {
  const schema = templateDayInputFor("CLASS");

  it("keeps the five fields of specification §5.1", () => {
    const parsed = schema.safeParse({
      entries: [
        row(2, {
          subject: "Хімія",
          teacherName: "Іваненко І. І.",
          zoomLink: "https://zoom.us/j/123",
          note: "Кабінет 12",
        }),
      ],
    });

    expect(parsed.success && parsed.data.entries[0].payload).toEqual({
      subject: "Хімія",
      teacherName: "Іваненко І. І.",
      zoomLink: "https://zoom.us/j/123",
      note: "Кабінет 12",
    });
  });

  it("leaves an optional field out rather than storing an empty string", () => {
    // An absent optional field means the key is absent — fixtures §8.8.
    const parsed = schema.safeParse({
      entries: [row(2, { subject: "Хімія", teacherName: "Іваненко І. І." })],
    });

    const payload = parsed.success ? parsed.data.entries[0].payload : undefined;
    expect(payload).toEqual({ subject: "Хімія", teacherName: "Іваненко І. І." });
    expect(Object.keys(payload ?? {})).toEqual(["subject", "teacherName"]);
  });

  it("demands the teacher's name once the row is filled", () => {
    const parsed = schema.safeParse({ entries: [row(2, { subject: "Хімія" })] });

    expect(
      !parsed.success && templateDayFieldErrors(parsed.error, [2]),
    ).toEqual({ [templateSlotField(2, "teacherName")]: "Вкажіть ПІБ учителя" });
  });

  it("refuses a Zoom link that is not an http(s) link", () => {
    // The rule and its message live in `slotFields.ts`, shared with the day
    // override form (T-011, `design/T-011-day-overrides.md` §5): `z.url()`
    // alone accepts schemes an `href` must never carry, so the check this
    // screen applies is pinned here as well as there.
    for (const zoomLink of [
      "zoom.us/j/123",
      "mailto:teacher@example.com",
      "javascript:alert(1)",
      "data:text/html,<p>",
      "ftp://files.example.com/room",
    ]) {
      const parsed = schema.safeParse({
        entries: [
          row(2, {
            subject: "Хімія",
            teacherName: "Іваненко І. І.",
            zoomLink,
          }),
        ],
      });

      expect(parsed.success, zoomLink).toBe(false);
      expect(
        !parsed.success &&
          Object.keys(templateDayFieldErrors(parsed.error, [2])),
        zoomLink,
      ).toEqual([templateSlotField(2, "zoomLink")]);
    }
  });

  it("accepts an http(s) Zoom link whatever its case", () => {
    const parsed = schema.safeParse({
      entries: [
        row(2, {
          subject: "Хімія",
          teacherName: "Іваненко І. І.",
          zoomLink: "HTTPS://zoom.us/j/123",
        }),
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("does not ask for a teacher on a row that is entirely empty", () => {
    const parsed = schema.safeParse({ entries: [row(0), row(2)] });

    expect(parsed.success && parsed.data.entries).toEqual([
      { lessonNumber: 0 },
      { lessonNumber: 2 },
    ]);
  });
});

describe("every payload the form produces", () => {
  it("parses through slotPayloadFor(), the one definition of the shape", () => {
    const own = templateDayInputFor("OWN").parse({
      entries: [row(1, { subject: "Математика", className: "7-А" })],
    });
    const klass = templateDayInputFor("CLASS").parse({
      entries: [
        row(1, {
          subject: "Хімія",
          teacherName: "Іваненко І. І.",
          zoomLink: "https://zoom.us/j/123",
          note: "Кабінет 12",
        }),
      ],
    });

    expect(
      slotPayloadFor("OWN").safeParse(own.entries[0].payload).success,
    ).toBe(true);
    expect(
      slotPayloadFor("CLASS").safeParse(klass.entries[0].payload).success,
    ).toBe(true);
  });
});

describe("templateDayFieldErrors", () => {
  it("names the field by lesson number and not by row position", () => {
    // The rows are the lesson numbers the school uses — 1, 2 and 5 is a normal
    // bell schedule — so the third row is lesson 5, not lesson 3.
    const parsed = templateDayInputFor("OWN").safeParse({
      entries: [row(1), row(2), row(5, { subject: "Фізика" })],
    });

    expect(
      !parsed.success && templateDayFieldErrors(parsed.error, [1, 2, 5]),
    ).toEqual({ [templateSlotField(5, "className")]: "Вкажіть клас" });
  });
});

describe("readTemplateDay", () => {
  it("reads every field of every row shown, blank ones included", () => {
    const formData = new FormData();
    formData.set(templateSlotField(1, "subject"), " Математика ");
    formData.set(templateSlotField(1, "className"), "7-А");

    expect(readTemplateDay(formData, [1, 4])).toEqual({
      entries: [
        row(1, { subject: " Математика ", className: "7-А" }),
        row(4),
      ],
    });
  });
});
