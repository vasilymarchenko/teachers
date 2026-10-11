import { describe, expect, it } from "vitest";
import { sameLesson } from "./slotFields";

/**
 * `sameLesson()` — the one test of "equal" behind the template day's «в обох
 * тижнях» (T-043, ADR-025). It compares as a save would store: trimmed, with a
 * blank optional field the same as an absent one.
 */
describe("sameLesson", () => {
  it("reads two identical lessons as equal", () => {
    expect(
      sameLesson("OWN", { subject: "Фізика", className: "7-А" }, { subject: "Фізика", className: "7-А" }),
    ).toBe(true);
  });

  it("does not tell lessons apart by a trailing space", () => {
    expect(
      sameLesson("OWN", { subject: "Фізика ", className: "7-А" }, { subject: "Фізика", className: " 7-А" }),
    ).toBe(true);
  });

  it("tells lessons apart by any field of the view", () => {
    expect(
      sameLesson("OWN", { subject: "Фізика", className: "7-А" }, { subject: "Фізика", className: "7-Б" }),
    ).toBe(false);
    expect(
      sameLesson(
        "CLASS",
        { subject: "Фізика", teacherName: "Коваль О. П.", note: "Зошит" },
        { subject: "Фізика", teacherName: "Коваль О. П." },
      ),
    ).toBe(false);
  });

  it("treats an absent optional field and a blank one as the same", () => {
    expect(
      sameLesson(
        "CLASS",
        { subject: "Фізика", teacherName: "Коваль О. П.", note: " " },
        { subject: "Фізика", teacherName: "Коваль О. П." },
      ),
    ).toBe(true);
  });

  it("reads no lesson on both sides as equal, and a lesson against none as not", () => {
    expect(sameLesson("OWN", undefined, undefined)).toBe(true);
    expect(sameLesson("OWN", { subject: "Фізика", className: "7-А" }, undefined)).toBe(false);
  });

  it("compares only the fields of the view", () => {
    // A stray key of the other view is not part of an OWN lesson.
    const stray = { subject: "Фізика", className: "7-А", note: "x" } as never;
    expect(sameLesson("OWN", stray, { subject: "Фізика", className: "7-А" })).toBe(true);
  });
});
