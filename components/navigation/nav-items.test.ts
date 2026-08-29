import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { excludedNavLabels, navItems } from "./nav-items";

const APP_DIR = join(process.cwd(), "app");

/** Every `page.tsx` under `app/`, as an absolute directory path. */
function pageDirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return pageDirectories(join(dir, entry.name));
    return entry.name === "page.tsx" ? [dir] : [];
  });
}

/**
 * The URL a page directory answers on: the path under `app/` with the route
 * groups removed, since `(calendar)` and friends are invisible in the URL.
 */
function routeOf(pageDir: string): string {
  const segments = relative(APP_DIR, pageDir)
    .split(sep)
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

const pageDirs = pageDirectories(APP_DIR);
const routes = new Set(pageDirs.map(routeOf));

/** Route-group segments the page sits in, e.g. `["(app)", "(calendar)"]`. */
function groupsOf(pageDir: string): string[] {
  return relative(APP_DIR, pageDir)
    .split(sep)
    .filter((segment) => /^\(.*\)$/.test(segment));
}

describe("navigation menu", () => {
  it.each(navItems)("«$label» opens a route that exists", ({ href }) => {
    expect([...routes]).toContain(href);
  });

  it("carries no menu item the first release excludes", () => {
    // Specification §8: these two are on the mockups but out of scope.
    const labels = navItems.map((item) => item.label);
    for (const excluded of excludedNavLabels) {
      expect(labels).not.toContain(excluded);
    }
  });

  it("opens every screen from inside the shell", () => {
    // A page reachable from the menu must render in the application chrome,
    // which is the `(app)` layout — T-014.
    for (const item of navItems) {
      const pageDir = pageDirs.find((dir) => routeOf(dir) === item.href);
      expect(groupsOf(pageDir!)).toContain("(app)");
    }
  });

  it("keeps the print routes outside the shell", () => {
    // Specification §7 and overview §2: printed pages carry no navigation. The
    // route group is what enforces it, so a `print` page that drifted inside
    // `(app)` would silently grow a navigation panel.
    const printPages = pageDirs.filter((dir) => routeOf(dir).startsWith("/print"));
    for (const pageDir of printPages) {
      expect(groupsOf(pageDir)).not.toContain("(app)");
    }
  });
});
