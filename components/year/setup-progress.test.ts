import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE, SETUP_PROGRESS } from "./labels";
import { SetupChecklist } from "./setup-checklist";
import {
  CompletionNotice,
  progressNotice,
  SetupProgress,
} from "./setup-progress";

/**
 * What the year-setup screen shows on the way to the open application —
 * overview §8.6, T-041.
 *
 * The suite has no DOM (`vitest.config.mts`), so nothing here submits a form:
 * the markup is rendered to a string, which is what the server sends, and the
 * one thing that only a mounted component knows — that this visit began with
 * setup incomplete — is `progressNotice()`, tested as the function it is. The
 * walk through the three saves in a browser is T-046.
 */

describe("progressNotice", () => {
  it("names the next item while setup is incomplete", () => {
    expect(
      progressNotice({ complete: false, openedIncomplete: true, hasNext: true }),
    ).toBe("next");
  });

  it("announces completion when this visit began incomplete", () => {
    // The save that completed it was made on this screen.
    expect(
      progressNotice({ complete: true, openedIncomplete: true, hasNext: false }),
    ).toBe("complete");
  });

  it("says nothing on a screen opened with setup already complete", () => {
    expect(
      progressNotice({ complete: true, openedIncomplete: false, hasNext: false }),
    ).toBeNull();
  });

  it("names the next item again when a deletion reopens the setup", () => {
    expect(
      progressNotice({ complete: false, openedIncomplete: false, hasNext: true }),
    ).toBe("next");
  });
});

describe("SetupProgress, as the server renders it", () => {
  it("shows the next item and a link to its section", () => {
    const html = renderToStaticMarkup(
      createElement(SetupProgress, {
        complete: false,
        next: { label: SETUP_GATE.items.semesters, href: "#semesters" },
      }),
    );
    expect(html).toContain(SETUP_PROGRESS.next);
    expect(html).toContain(SETUP_GATE.items.semesters);
    expect(html).toContain('href="#semesters"');
    expect(html).toContain("sticky");
  });

  it("is empty on the ordinary screen", () => {
    const html = renderToStaticMarkup(
      createElement(SetupProgress, { complete: true, next: null }),
    );
    expect(html).not.toContain(SETUP_PROGRESS.completeTitle);
    expect(html).not.toContain("<a");
  });
});

describe("CompletionNotice", () => {
  const html = renderToStaticMarkup(createElement(CompletionNotice));

  it("says setup is complete and the rest of the application is open", () => {
    expect(html).toContain(SETUP_PROGRESS.completeTitle);
    expect(html).toContain(SETUP_PROGRESS.completeText);
  });

  it("offers the weekly template first, and the calendar beside it", () => {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);
    expect(hrefs).toStrictEqual(["/schedule", "/calendar"]);
    expect(html).toContain(SETUP_PROGRESS.toSchedule);
  });
});

describe("SetupChecklist", () => {
  const status: SetupStatus = {
    complete: false,
    hasBellSchedule: false,
    years: [
      { academicYearId: "year-1", hasInitialAnchor: true, hasBothSemesters: false },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(SetupChecklist, { status, academicYearId: "year-1" }),
  );
  const links = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    ([, href, text]) => [href, text],
  );

  it("links each missing item to the section it is entered in", () => {
    expect(links).toStrictEqual([
      ["#semesters", SETUP_GATE.items.semesters],
      ["#bells", SETUP_GATE.items.bellSchedule],
    ]);
  });

  it("leaves an item that is there as plain text", () => {
    expect(html).toContain(SETUP_GATE.items.academicYear);
    expect(links.map(([, text]) => text)).not.toContain(
      SETUP_GATE.items.academicYear,
    );
  });
});
