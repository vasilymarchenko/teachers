import { describe, expect, it } from "vitest";
import { dayOverrideKindEnum } from "@/lib/db/schema/enums";
import {
  DAY_OVERRIDE_FIELD,
  dayOverrideInputFor,
  EDITABLE_OVERRIDE_KINDS,
  parseLessonNumber,
  readDayOverride,
} from "./dayOverride";
import { slotPayloadFor } from "./slotPayload";

/**
 * The Zod boundary of the day-override form — overview §3.3, schema §4.9.
 *
 * The expectations come from specification §5.1 (which fields each view has),
 * §5.3 and §5.4 (what an override is), and `design/expand-fixtures.md` §8.8
 * (an absent optional field is an absent **key**). None of them was obtained by
 * running the code.
 */

const FILLED_OWN = {
  kind: "EDIT",
  subject: "Алгебра",
  className: "9-А",
  teacherName: "",
  zoomLink: "",
  note: "",
};

const FILLED_CLASS = {
  kind: "SUBSTITUTION",
  subject: "Фізика",
  className: "",
  teacherName: "Ткаченко Л. В.",
  zoomLink: "https://zoom.us/j/7a-phys",
  note: "кабінет 12",
};

describe("the day-override form", () => {
  it("produces the payload of the view, and only that view's fields", () => {
    const own = dayOverrideInputFor("OWN").parse(FILLED_OWN);
    expect(own).toEqual({
      kind: "EDIT",
      payload: { subject: "Алгебра", className: "9-А" },
    });

    const forClass = dayOverrideInputFor("CLASS").parse(FILLED_CLASS);
    expect(forClass).toEqual({
      kind: "SUBSTITUTION",
      payload: {
        subject: "Фізика",
        teacherName: "Ткаченко Л. В.",
        zoomLink: "https://zoom.us/j/7a-phys",
        note: "кабінет 12",
      },
    });
  });

  it("produces a payload `slotPayloadFor()` accepts — the same shape as a slot", () => {
    // Schema §7: `day_override.payload` and `template_slot.payload` are parsed
    // by one module, so an override renders as a lesson wherever a slot does.
    for (const [view, input] of [
      ["OWN", FILLED_OWN],
      ["CLASS", FILLED_CLASS],
    ] as const) {
      const { payload } = dayOverrideInputFor(view).parse(input);
      expect(slotPayloadFor(view).safeParse(payload).success, view).toBe(true);
    }
  });

  it("leaves an untouched optional field out as a key (fixtures §8.8)", () => {
    const { payload } = dayOverrideInputFor("CLASS").parse({
      ...FILLED_CLASS,
      zoomLink: "",
      note: "   ",
    });

    expect(payload).toEqual({ subject: "Фізика", teacherName: "Ткаченко Л. В." });
    expect("zoomLink" in payload).toBe(false);
    expect("note" in payload).toBe(false);
  });

  it("requires the fields the view cannot render a lesson without", () => {
    const own = dayOverrideInputFor("OWN").safeParse({
      ...FILLED_OWN,
      className: "",
    });
    expect(fieldsOf(own)).toEqual(["className"]);

    const forClass = dayOverrideInputFor("CLASS").safeParse({
      ...FILLED_CLASS,
      subject: "",
      teacherName: "",
    });
    expect(fieldsOf(forClass)).toEqual(["subject", "teacherName"]);
  });

  it("does not ask for a field the other view has", () => {
    // «Мої уроки» has three fields and «уроки класу» five (§5.1): a blank
    // `teacherName` is not a missing field of an `OWN` override.
    expect(dayOverrideInputFor("OWN").safeParse(FILLED_OWN).success).toBe(true);
    expect(
      dayOverrideInputFor("CLASS").safeParse({ ...FILLED_CLASS, className: "" })
        .success,
    ).toBe(true);
  });

  it("refuses an all-blank submission, on the subject", () => {
    // Not «a lesson with no content»: an empty override has no meaning the
    // model can hold. Cancelling and removing are their own actions.
    const result = dayOverrideInputFor("OWN").safeParse({
      ...FILLED_OWN,
      subject: "  ",
      className: "",
    });

    expect(fieldsOf(result)).toEqual(["subject"]);
    expect(result.error?.issues[0].message).toContain("Скасувати урок");
  });

  it("rejects a Zoom link that is not a link, and text that is too long", () => {
    expect(
      fieldsOf(
        dayOverrideInputFor("CLASS").safeParse({
          ...FILLED_CLASS,
          zoomLink: "кабінет 12",
        }),
      ),
    ).toEqual(["zoomLink"]);

    expect(
      fieldsOf(
        dayOverrideInputFor("OWN").safeParse({
          ...FILLED_OWN,
          subject: "я".repeat(121),
        }),
      ),
    ).toEqual(["subject"]);
  });

  it("accepts only the two kinds that carry a lesson", () => {
    // A tombstone has no payload at all (schema §4.9), so `CLEARED` is written
    // by its own action and can never arrive through this form.
    expect(EDITABLE_OVERRIDE_KINDS).toEqual(["EDIT", "SUBSTITUTION"]);
    expect(dayOverrideKindEnum.enumValues).toEqual([
      ...EDITABLE_OVERRIDE_KINDS,
      "CLEARED",
    ]);

    for (const kind of ["CLEARED", "", "edit"]) {
      expect(
        fieldsOf(dayOverrideInputFor("OWN").safeParse({ ...FILLED_OWN, kind })),
        kind,
      ).toEqual(["kind"]);
    }
  });

  it("reads every field of both views off the form, blank for the absent ones", () => {
    const formData = new FormData();
    formData.set(DAY_OVERRIDE_FIELD.kind, "EDIT");
    formData.set(DAY_OVERRIDE_FIELD.subject, "Алгебра");

    // A form that never rendered `className` and one that rendered it empty
    // must be the same submission — that is what makes «the lesson is blank» a
    // question about the teacher's input rather than about `FormData` keys.
    expect(readDayOverride(formData)).toEqual({
      kind: "EDIT",
      subject: "Алгебра",
      className: "",
      teacherName: "",
      zoomLink: "",
      note: "",
    });
  });
});

describe("the lesson number in the URL", () => {
  it("accepts the ten numbers a lesson can have (specification §3.3)", () => {
    for (let lessonNumber = 0; lessonNumber <= 9; lessonNumber += 1) {
      expect(parseLessonNumber(String(lessonNumber))).toBe(lessonNumber);
    }
  });

  it("refuses anything else, so the screen can answer 404", () => {
    // `'01'` and `'1.0'` are the same lesson written differently; accepting
    // them would give one lesson several URLs. `'10'` is outside
    // `day_override_number_ck` altogether.
    for (const segment of ["", " ", "10", "-1", "01", "1.0", "1e0", "три"]) {
      expect(parseLessonNumber(segment), segment).toBeUndefined();
    }
  });
});

/** The field names a failed parse complained about, in order, without repeats. */
function fieldsOf(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  const fields = (result.error?.issues ?? []).map((issue) =>
    String(issue.path[0]),
  );
  return [...new Set(fields)];
}
