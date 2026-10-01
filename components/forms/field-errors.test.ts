import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FormState } from "@/lib/validation/formState";
import { formErrorsOf } from "./field-errors";
import { FormField, type FieldControlProps } from "./form-field";
import { FormMessage } from "./form-message";

/**
 * A refusal an action returned is shown somewhere, whichever form submitted —
 * T-023, overview §8.2.
 *
 * The case being pinned is the one found twice by hand (T-009, T-010): the
 * action keys its message to a field, and the form that submitted does not
 * render that field. Before `formErrorsOf()` the message rendered nowhere.
 */

const BOUNDARY_MESSAGE =
  "Немає семестру, який ще триває. Додайте семестри в налаштуваннях року або виберіть дату";

describe("formErrorsOf()", () => {
  it("gives a field its own message", () => {
    const errors = formErrorsOf({ fieldErrors: { dateTo: "Поза межами року" } });

    expect(errors.for("dateTo")).toBe("Поза межами року");
    expect(errors.for("dateFrom")).toBeUndefined();
  });

  it("reports a field message no control asked for", () => {
    const errors = formErrorsOf({
      fieldErrors: { dateTo: "Поза межами року", boundaryKind: BOUNDARY_MESSAGE },
    });

    errors.for("dateTo");

    expect(errors.unclaimed()).toStrictEqual([BOUNDARY_MESSAGE]);
  });

  it("puts the form-level message first and keeps it beside the unclaimed ones", () => {
    const errors = formErrorsOf({
      error: "Ці дати перетинаються з іншим роком",
      fieldErrors: { boundaryKind: BOUNDARY_MESSAGE },
    });

    expect(errors.unclaimed()).toStrictEqual([
      "Ці дати перетинаються з іншим роком",
      BOUNDARY_MESSAGE,
    ]);
  });

  it("reports nothing once every message has a control", () => {
    const errors = formErrorsOf({ fieldErrors: { dateTo: "Поза межами року" } });

    errors.for("dateTo");

    expect(errors.unclaimed()).toStrictEqual([]);
  });
});

/**
 * The same thing through the components a form is built from, rendered to a
 * string — which is also what a browser with JavaScript off receives.
 */
describe("a form rendering a FormState", () => {
  /** A form with one control, `dateTo`, shaped the way every form here is. */
  const render = (state: FormState): string => {
    const errors = formErrorsOf(state);

    // The suite collects `*.test.ts`, so there is no JSX here; the control is a
    // render prop, which `createElement`'s rest arguments are not typed to take.
    const field = {
      name: "dateTo",
      label: "Дата завершення",
      error: errors.for("dateTo"),
      children: (props: FieldControlProps) => createElement("input", props),
    };

    return renderToStaticMarkup(
      createElement(
        "form",
        null,
        createElement(FormField, field),
        createElement(FormMessage, { errors }),
      ),
    );
  };

  it("shows a field error whose field the form does not render", () => {
    const html = render({ fieldErrors: { boundaryKind: BOUNDARY_MESSAGE } });

    expect(html).toContain(BOUNDARY_MESSAGE);
    expect(html).toContain('role="alert"');
  });

  it("shows a rendered field's error on its control, and only there", () => {
    const html = render({ fieldErrors: { dateTo: "Поза межами року" } });

    expect(html).toContain("Поза межами року");
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain('role="alert"');
  });

  it("renders no message for a clean state", () => {
    expect(render({})).not.toContain('role="alert"');
  });
});

/**
 * What makes the above hold for a form nobody has written yet: `fieldErrors`
 * is read in one place. A form that indexed it directly would show the keys it
 * thought of and silently drop the rest, which is the defect this replaces.
 */
describe("the forms", () => {
  const ROOT = process.cwd();
  const SHARED = join("components", "forms");

  const sources = (directory: string): string[] =>
    readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
        ? [path]
        : [];
    });

  it("read field errors only through formErrorsOf()", () => {
    const direct = [...sources("app"), ...sources("components")]
      // The shared layer itself is the one place allowed to.
      .filter((path) => relative(SHARED, path).startsWith(".."))
      .filter((path) => /\.fieldErrors\b/.test(readFileSync(join(ROOT, path), "utf8")));

    expect(direct).toStrictEqual([]);
  });
});
