import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE, SETUP_PROGRESS } from "./labels";
import { SetupChecklist } from "./setup-checklist";
import {
  CompletionNotice,
  progressNotice,
  type ProgressMemory,
  rememberRender,
  SetupProgress,
} from "./setup-progress";

/**
 * What the year-setup screen shows on the way to the open application —
 * overview §8.6, T-041.
 *
 * The suite has no DOM (`vitest.config.mts`), so nothing here submits a form:
 * the markup is rendered to a string, which is what the server sends, and the
 * one thing only a mounted component knows — which render completed setup — is
 * `rememberRender()` and `progressNotice()`, folded over a sequence of renders
 * as the page would produce them. The walk through the three saves in a
 * browser is T-046.
 */

describe("progressNotice", () => {
  it("names the next item while setup is incomplete", () => {
    expect(
      progressNotice({ complete: false, completedHere: false, hasNext: true }),
    ).toBe("next");
  });

  it("announces completion on the render that completed setup", () => {
    expect(
      progressNotice({ complete: true, completedHere: true, hasNext: false }),
    ).toBe("complete");
  });

  it("says nothing on any other render of a complete setup", () => {
    expect(
      progressNotice({ complete: true, completedHere: false, hasNext: false }),
    ).toBeNull();
  });
});

describe("rememberRender, over the renders of one mount", () => {
  /**
   * The notice after each render. Every render is a server render, so each
   * gets an id of its own — as `randomUUID()` gives the page one per request.
   */
  function walk(completes: boolean[]): ReturnType<typeof progressNotice>[] {
    let memory: ProgressMemory = { complete: completes[0], completedIn: null };
    return completes.map((complete, index) => {
      const renderId = `render-${index}`;
      memory = rememberRender(memory, { complete, renderId });
      return progressNotice({
        complete,
        completedHere: memory.completedIn === renderId,
        hasNext: !complete,
      });
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

  it("opened again after completing — the menu, the year switcher — is ordinary", () => {
    // Review of PR #50: a navigation that stays on `/year` does not remount
    // the bar, so the render after the completing one must clear it.
    expect(walk([false, true, true])).toStrictEqual(["next", "complete", null]);
  });

  it("keeps the same memory when nothing changed", () => {
    const memory: ProgressMemory = { complete: true, completedIn: "render-1" };
    expect(rememberRender(memory, { complete: true, renderId: "render-2" })).toBe(
      memory,
    );
  });
});

describe("SetupProgress, as the server renders it", () => {
  it("shows the next item and a link to its section", () => {
    const html = renderToStaticMarkup(
      createElement(SetupProgress, {
        complete: false,
        next: { label: SETUP_GATE.items.semesters, href: "#semesters" },
        renderId: "render-0",
      }),
    );
    expect(html).toContain(SETUP_PROGRESS.next);
    expect(html).toContain(SETUP_GATE.items.semesters);
    expect(html).toContain('href="#semesters"');
    expect(html).toContain("sticky");
  });

  it("is empty on the ordinary screen", () => {
    const html = renderToStaticMarkup(
      createElement(SetupProgress, {
        complete: true,
        next: null,
        renderId: "render-0",
      }),
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
