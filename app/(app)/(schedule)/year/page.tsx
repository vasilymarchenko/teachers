import Link from "next/link";
import { BellsSection } from "@/components/year/bells-section";
import { PAGE_LABELS, YEAR_SECTION } from "@/components/year/labels";
import { ParitySection } from "@/components/year/parity-section";
import { PeriodsSection } from "@/components/year/periods-section";
import { RulesSection } from "@/components/year/rules-section";
import { Section } from "@/components/year/section";
import { pickYear } from "@/components/year/selection";
import { SemestersSection } from "@/components/year/semesters-section";
import { YearForm } from "@/components/year/year-form";
import { YearSwitcher } from "@/components/year/year-switcher";
import { requireUser } from "@/lib/auth/session";
import { getBellSchedule } from "@/lib/db/queries/bells";
import {
  listAcademicYears,
  listNonTeachingPeriods,
  listParityAnchors,
  listSemesters,
  listWeekdayRules,
} from "@/lib/db/queries/yearSetup";
import { today } from "@/lib/time/today";

// The teacher's own data, read per request; nothing may be frozen into the
// build.
export const dynamic = "force-dynamic";

/**
 * Year setup — specification §3 and §4, the frame every other screen reads.
 *
 * The whole of §3 on one page, in the order the specification introduces it:
 * the year's bounds, its semesters, its non-teaching periods, the weekdays with
 * no lessons, the bells, and the parity of the week. A teacher sets this up
 * once and comes back to it a few times a year, so it is one page to work down
 * rather than five to navigate between.
 *
 * One year is edited at a time and the URL says which (`?year=…`), because
 * next September's year can be prepared while this one is still running. Which
 * year that is when the URL says nothing is `pickYear()`.
 *
 * The sections are client components — each form needs `useActionState` — but
 * every read happens here, on the server, and no section fetches anything of
 * its own.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  // The boundary first, before anything reads (overview §8.3).
  const { id: userId } = await requireUser();

  const { year: requested } = await searchParams;
  const [years, bells] = await Promise.all([
    listAcademicYears(userId),
    // Not scoped to the year: `bell_schedule` is keyed by user and lesson
    // number alone (schema §4.5), so it is read whether or not a year exists.
    getBellSchedule(userId),
  ]);

  const selected = pickYear(
    years,
    typeof requested === "string" ? requested : undefined,
    today(),
  );

  const frame =
    selected === null
      ? null
      : await Promise.all([
          listSemesters(userId, selected.id),
          listNonTeachingPeriods(userId, selected.id),
          listWeekdayRules(userId, { from: selected.dateFrom, to: selected.dateTo }),
          listParityAnchors(userId, { from: selected.dateFrom, to: selected.dateTo }),
        ]);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_LABELS.title}</h1>
        <p className="text-muted-foreground text-sm">{PAGE_LABELS.intro}</p>
      </div>

      <Section
        title={YEAR_SECTION.title}
        description={YEAR_SECTION.description}
      >
        {selected === null ? (
          <p className="text-muted-foreground text-sm">{PAGE_LABELS.noYears}</p>
        ) : (
          <>
            {years.length > 1 ? (
              <YearSwitcher selectedId={selected.id} years={years} />
            ) : null}
            <YearForm
              initialParity={
                frame?.[3].find((anchor) => anchor.date === selected.dateFrom)
                  ?.parity
              }
              year={selected}
            />
          </>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{YEAR_SECTION.addTitle}</h3>
          <YearForm />
        </div>
      </Section>

      {selected !== null && frame !== null ? (
        <>
          <SemestersSection
            academicYearId={selected.id}
            semesters={frame[0]}
          />
          <PeriodsSection academicYearId={selected.id} periods={frame[1]} />
          <RulesSection academicYearId={selected.id} rules={frame[2]} />
        </>
      ) : null}

      <BellsSection bells={bells} />

      {selected !== null && frame !== null ? (
        <ParitySection
          academicYearId={selected.id}
          anchors={frame[3]}
          yearStart={selected.dateFrom}
        />
      ) : null}

      <p className="text-sm">
        <Link className="underline underline-offset-2" href="/calendar">
          {PAGE_LABELS.toCalendar}
        </Link>
      </p>
    </div>
  );
}
