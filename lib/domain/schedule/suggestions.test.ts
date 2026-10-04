import { describe, expect, it } from "vitest";
import { collectSuggestions, type SuggestionSource } from "./suggestions";

/**
 * The suggestion lists of T-044. Expectations come from the Ukrainian alphabet
 * (А Б В Г Ґ Д Е Є Ж З И І Ї Й …) and from overview §4, not from running the
 * function.
 */

const own = (subject: string | null, className: string | null): SuggestionSource => ({
  view: "OWN",
  subject,
  className,
  teacherName: null,
});

const cls = (subject: string | null, teacherName: string | null): SuggestionSource => ({
  view: "CLASS",
  subject,
  className: null,
  teacherName,
});

describe("collectSuggestions", () => {
  it("returns three empty lists when nothing has been entered", () => {
    expect(collectSuggestions([])).toEqual({
      subjects: [],
      classNames: [],
      teacherNames: [],
    });
  });

  it("sorts in the order of the Ukrainian alphabet, not by code point", () => {
    // Ґ, Є, І and Ї sit outside U+0410–U+044F, so a code-point sort would put
    // «Історія» and «Інформатика» before «Алгебра».
    const { subjects } = collectSuggestions([
      own("Історія", null),
      own("Їжа і здоров'я", null),
      own("Алгебра", null),
      own("Інформатика", null),
      own("Ґрунтознавство", null),
      own("Географія", null),
      own("Етика", null),
      own("Єдиноборства", null),
      own("Дизайн", null),
    ]);

    expect(subjects).toEqual([
      "Алгебра",
      "Географія",
      "Ґрунтознавство",
      "Дизайн",
      "Етика",
      "Єдиноборства",
      "Інформатика",
      "Історія",
      "Їжа і здоров'я",
    ]);
  });

  it("orders the number in a class name by value", () => {
    const { classNames } = collectSuggestions([
      own("Алгебра", "10-А"),
      own("Алгебра", "8-В"),
      own("Алгебра", "8-А"),
      own("Алгебра", "9-Б"),
      own("Алгебра", "8-Б"),
    ]);

    expect(classNames).toEqual(["8-А", "8-Б", "8-В", "9-Б", "10-А"]);
  });

  it("trims values and drops the ones that are empty or absent", () => {
    const suggestions = collectSuggestions([
      own("  Фізика ", " 7-А"),
      own("", "   "),
      own(null, null),
      cls("\tХімія\n", "  Петренко О. І.  "),
      cls("   ", ""),
    ]);

    expect(suggestions).toEqual({
      subjects: ["Фізика", "Хімія"],
      classNames: ["7-А"],
      teacherNames: ["Петренко О. І."],
    });
  });

  it("offers each value once, comparing after the trim", () => {
    const suggestions = collectSuggestions([
      own("Фізика", "7-А"),
      own(" Фізика", "7-А "),
      cls("Фізика", "Петренко О. І."),
      cls("Фізика ", "Петренко О. І."),
    ]);

    expect(suggestions).toEqual({
      subjects: ["Фізика"],
      classNames: ["7-А"],
      teacherNames: ["Петренко О. І."],
    });
  });

  it("keeps two spellings that differ only in case", () => {
    // Overview §4: «Математика» / «математика» is the accepted price of free
    // text; the suggestions show it rather than pick one.
    const { subjects } = collectSuggestions([
      own("Математика", null),
      cls("математика", null),
    ]);

    expect(subjects).toHaveLength(2);
    expect(subjects).toEqual(
      expect.arrayContaining(["Математика", "математика"]),
    );
  });

  it("takes subjects from both views, class names from OWN and teacher names from CLASS", () => {
    // The stray keys stand for a payload whose shape does not match its view:
    // the database does not enforce the shape (schema §7), so the view is
    // what decides the list.
    const suggestions = collectSuggestions([
      { view: "OWN", subject: "Алгебра", className: "9-А", teacherName: "Зайвий" },
      { view: "CLASS", subject: "Біологія", className: "Зайвий", teacherName: "Коваль Н. П." },
    ]);

    expect(suggestions).toEqual({
      subjects: ["Алгебра", "Біологія"],
      classNames: ["9-А"],
      teacherNames: ["Коваль Н. П."],
    });
  });
});
