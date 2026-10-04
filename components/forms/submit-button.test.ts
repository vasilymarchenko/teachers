import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmitButton, UNCHANGED_REASON } from "./submit-button";
import { TrackedForm } from "./tracked-form";

/**
 * T-047, rendered to a string — what a browser with JavaScript off gets, and
 * what hydration starts from. The behaviour after hydration is the tracker's
 * and is tested in `form-changes.test.ts`.
 */
// `children` is a required string prop, which `createElement`'s rest arguments
// are not typed to fill — so the props are one object, as in
// `field-errors.test.ts`.
const props = { pendingLabel: "Зберігаємо…", children: "Зберегти" };
const button = createElement(SubmitButton, props);
const action = () => {};

describe("SubmitButton before hydration", () => {
  it("is available in an opted-in form, and says nothing", () => {
    const html = renderToStaticMarkup(
      createElement(TrackedForm, { action, state: {} }, button),
    );

    expect(html).toContain(">Зберегти</button>");
    expect(html).not.toContain("aria-disabled");
    // The attribute, not the `disabled:` variants in the class list.
    expect(html).not.toMatch(/\sdisabled[=\s>]/);
    expect(html).not.toContain(UNCHANGED_REASON);
  });

  it("is the button it always was outside an opted-in form", () => {
    const html = renderToStaticMarkup(
      createElement(TrackedForm, { action, state: {}, tracked: false }, button),
    );

    expect(html).toContain(">Зберегти</button>");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("aria-disabled");
  });
});
