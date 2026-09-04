import { describe, expect, it } from "vitest";
import { z } from "zod";
import { invalidInput, rejected, rejectedField, submittedValues } from "./formState";

/**
 * The form-state helpers every year-setup action returns through.
 *
 * Two properties are worth pinning: what is echoed back to the form is the
 * teacher's submission and nothing React added to it, and a cross-field issue
 * that names no field ends up somewhere visible rather than being swallowed.
 */

const formDataOf = (entries: Record<string, string>): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.append(key, value);
  return formData;
};

describe("submittedValues()", () => {
  it("returns the submitted fields", () => {
    expect(submittedValues(formDataOf({ dateFrom: "2026-09-01", name: "Осінні" }))).toStrictEqual({
      dateFrom: "2026-09-01",
      name: "Осінні",
    });
  });

  it("drops React's own action fields", () => {
    // `Object.fromEntries(formData)` carries `$ACTION_*` entries; echoing them
    // back into the form would put React's internals into a value attribute.
    const values = submittedValues(
      formDataOf({ $ACTION_ID_abc: "1", $ACTION_REF_1: "", name: "Зимові" }),
    );

    expect(values).toStrictEqual({ name: "Зимові" });
  });

  it("drops a file, which no form here submits", () => {
    const formData = formDataOf({ name: "Весняні" });
    formData.append("upload", new File(["x"], "x.txt"));

    expect(submittedValues(formData)).toStrictEqual({ name: "Весняні" });
  });
});

describe("invalidInput()", () => {
  const schema = z
    .object({ dateFrom: z.string().min(1, "Виберіть дату"), dateTo: z.string() })
    .refine((value) => value.dateFrom <= value.dateTo, {
      message: "Дата завершення не може бути раніша за дату початку",
      path: ["dateTo"],
    });

  it("puts one message on each field that failed", () => {
    const parsed = schema.safeParse({ dateFrom: "", dateTo: "" });
    const state = invalidInput(parsed.error!, formDataOf({ dateFrom: "", dateTo: "" }));

    expect(state.fieldErrors).toStrictEqual({ dateFrom: "Виберіть дату" });
    expect(state.error).toBeUndefined();
    expect(state.values).toStrictEqual({ dateFrom: "", dateTo: "" });
  });

  it("puts a refine's message on the field it names", () => {
    const parsed = schema.safeParse({ dateFrom: "2026-09-01", dateTo: "2026-08-31" });
    const state = invalidInput(parsed.error!, new FormData());

    expect(state.fieldErrors).toStrictEqual({
      dateTo: "Дата завершення не може бути раніша за дату початку",
    });
  });

  it("does not lose an issue that names no field", () => {
    // Every refine in this directory sets `path`; this is the safety net for
    // the one that forgets.
    const anonymous = z
      .object({ a: z.string() })
      .refine(() => false, "Щось не так із введеними даними");
    const parsed = anonymous.safeParse({ a: "x" });

    expect(invalidInput(parsed.error!, new FormData()).error).toBe(
      "Щось не так із введеними даними",
    );
  });
});

describe("the plain refusals", () => {
  it("reports a message about the submission as a whole", () => {
    const state = rejected("Ці дати перетинаються з іншим роком", formDataOf({ a: "1" }));

    expect(state).toStrictEqual({
      error: "Ці дати перетинаються з іншим роком",
      values: { a: "1" },
    });
  });

  it("reports a message about one field", () => {
    const state = rejectedField("dateTo", "Поза межами року", new FormData());

    expect(state.fieldErrors).toStrictEqual({ dateTo: "Поза межами року" });
    expect(state.error).toBeUndefined();
  });
});
