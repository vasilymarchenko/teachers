import { SignOutButton } from "@/components/sign-out-button";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

/**
 * The dark left navigation panel of specification §8.
 *
 * Two renderings of the same menu rather than one that reflows: a permanent
 * left column from `md` up, and a disclosure at phone width. They share
 * `NavLinks` and this footer, so the menu is still defined once
 * (`nav-items.ts`).
 */
export function AppNav({ teacherName }: { teacherName: string }) {
  const footer = (
    <div className="border-sidebar-border flex flex-col gap-3 border-t pt-4">
      {/* No punctuation after the name: a teacher's name is normally written
          with initials and already ends in a full stop. */}
      <p className="text-sidebar-foreground/70 px-3 text-sm">{teacherName}</p>
      <div className="px-3">
        {/* The panel is dark, so the button borrows the sidebar tokens
            rather than the work area's light `outline` colours. */}
        <SignOutButton className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
      </div>
    </div>
  );

  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <p className="px-3 pt-2 text-xl font-semibold">Щоденник учителя</p>
        <nav aria-label="Головне меню" className="flex-1">
          <NavLinks />
        </nav>
        {footer}
      </aside>

      <MobileNav footer={footer} />
    </>
  );
}
