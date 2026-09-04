import Link from "next/link";
import type { AcademicYearRow } from "@/lib/db/queries/yearSetup";
import { cn } from "@/lib/utils";
import { fullDate, PAGE_LABELS } from "./labels";

/**
 * Which year the screen is editing, when there is more than one.
 *
 * Plain links rather than a control: the selected year is in the URL
 * (`?year=…`, `selection.ts`), so a link is what changing it *is*, and the
 * whole page is server-rendered around the choice. One year needs no switcher —
 * the sections below already say which year they belong to.
 */
export function YearSwitcher({
  years,
  selectedId,
}: {
  years: AcademicYearRow[];
  selectedId: string;
}) {
  if (years.length < 2) return null;

  return (
    <nav aria-label={PAGE_LABELS.selectedYear} className="flex flex-wrap gap-2">
      {years.map((year) => {
        const isSelected = year.id === selectedId;

        return (
          <Link
            key={year.id}
            href={`/year?year=${year.id}`}
            aria-current={isSelected ? "true" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {`${fullDate(year.dateFrom)} — ${fullDate(year.dateTo)}`}
          </Link>
        );
      })}
    </nav>
  );
}
