import {
  CalendarDays,
  CalendarRange,
  ListChecks,
  Table2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  /** The menu label, as the teacher reads it. */
  label: string;
  /** The route it opens. Checked against the real routes in the test. */
  href: string;
  icon: LucideIcon;
};

/**
 * The navigation menu — the single place it is defined.
 *
 * One item per screen of the first release, named after the specification's own
 * section titles: Календар (§6, the main screen), Розклад (§5, the weekly
 * template), Події (§6.3) and Навчальний рік (§3, boundaries, bells, parity).
 *
 * Specification §8 excludes two items that appear on the mockups —
 * «Календарне планування» and «Розробка уроку». They are absent here, and
 * `nav-items.test.ts` fails if either comes back.
 */
export const navItems: readonly NavItem[] = [
  { label: "Календар", href: "/calendar", icon: CalendarDays },
  { label: "Розклад", href: "/schedule", icon: Table2 },
  { label: "Події", href: "/events", icon: ListChecks },
  { label: "Навчальний рік", href: "/year", icon: CalendarRange },
];

/** Menu items of the mockups that the first release does not carry (§8). */
export const excludedNavLabels: readonly string[] = [
  "Календарне планування",
  "Розробка уроку",
];
