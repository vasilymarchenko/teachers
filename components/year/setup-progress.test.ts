import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE, SETUP_PROGRESS } from "./labels";
import { SetupChecklist } from "./setup-checklist";
import {
  CompletionNotice,
  progressNotice,
  seenIncompleteAfter,
  SetupProgress,
} from "./setup-progress";

/**
 * What the year-setup screen shows on the way to the open application —
 * overview §8.6, T-041.
 *
 * The suite has no DOM (`vitest.config.mts`), so nothing here submits a form:
 * the markup is rendered to a string, which is what the server sends, and the
 * one thing that only a mounted component knows — that setup has been
 * incomplete during this visit — is `seenIncompleteAfter()` and
 * `progressNotice()`, tested as the functions they are, over a sequence of
 * renders. The walk through the three saves in a browser is T-046.
 */

describe("progressNotice", () => {
  it("names the next item while setup is incomplete", () => {
    expect(
      progressNotice({ complete: false, seenIncomplete: true, hasNext: true }),
    ).toBe("next");
  });

  it("announces completion when setup was incomplete during this visit", () => {
    // The save that completed it was made on this screen.
    expect(
      progressNotice({ complete: true, seenIncomplete: true, hasNext: false }),
    ).toBe("complete");
  });

  it("says nothing on a screen opened with setup already complete", () => {
    expect(
      progressNotice({ complete: true, seenIncomplete: false, hasNext: false }),
    ).toBeNull();
  });
});

describe("seenIncompleteAfter, over the renders of one visit", () => {
  /** The notice after each render, given `complete` at each one. */
  function walk(completes: boolean[]): ReturnType<typeof progressNotice>[] {
    let seen = !completes[0];
    return completes.map((complete) => {
      seen = seenIncompleteAfter(seen, complete);
      return progressNotice({ complete, seenIncomplete: seen, hasNext: !complete });
    });
  }

  it("a first setup: incomplete, then completed by a save", () => {
    expect(walk([false, false, true])).toStrictEqual(["next", "next", "complete"]);
  });

  it("opened complete and left so: the ordinary screen throughout", () => {
    expect(walk([true, true])).toStrictEqual([null, null]);
  });

  it("opened complete, reopened by a deletion, completed again by a save", () => {
    // Review R1-2: the save that completes it is still one made on this
    // screen, and is answered as one.
    expect(walk([true, false, true])).toStrictEqual([null, "next", "complete"]);
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
