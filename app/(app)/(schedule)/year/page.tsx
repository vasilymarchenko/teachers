import { randomUUID } from "node:crypto";
import Link from "next/link";
import { BellsSection } from "@/components/year/bells-section";
import {
  PAGE_LABELS,
  SETUP_GATE,
  YEAR_SECTION,
} from "@/components/year/labels";
import { ParitySection } from "@/components/year/parity-section";
import { PeriodsSection } from "@/components/year/periods-section";
import { RulesSection } from "@/components/year/rules-section";
import { Section } from "@/components/year/section";
import { pickYear } from "@/components/year/selection";
import { SemestersSection } from "@/components/year/semesters-section";
import { SetupChecklist } from "@/components/year/setup-checklist";
import { SetupProgress } from "@/components/year/setup-progress";
import {
  nextSetupStep,
  SETUP_ANCHORS,
  setupSteps,
} from "@/components/year/setup-steps";
import { YearForm } from "@/components/year/year-form";
import { YearSwitcher } from "@/components/year/year-switcher";
import { requireUser } from "@/lib/auth/session";
import { getBellSchedule } from "@/lib/db/queries/bells";
import { getSetupStatus } from "@/lib/db/queries/setupStatus";
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
 *
 * This is the one page of the `(app)` group that does **not** call
 * `requireCompleteSetup()`: it is where the gate sends a teacher whose setup is
 * incomplete (overview §8.6). In that state it says so, lists what is still
 * missing with a link to where each is entered, marks the sections she may
 * skip, and offers no way out to a screen that would only send her back. The
 * bar at the bottom names the next missing item, and when a save here completes
 * the setup it says so and offers the weekly template (T-041).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  // The boundary first, before anything reads (overview §8.3).
  const { id: userId } = await requireUser();

  const { year: requested } = await searchParams;
  const [years, bells, setup] = await Promise.all([
    listAcademicYears(userId),
    // Not scoped to the year: `bell_schedule` is keyed by user and lesson
    // number alone (schema §4.5), so it is read whether or not a year exists.
    getBellSchedule(userId),
    getSetupStatus(userId),
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

  const optionalMark = setup.complete ? undefined : SETUP_GATE.optional;
  const next = nextSetupStep(setupSteps(setup, selected?.id ?? null));

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_LABELS.title}</h1>
        <p className="text-muted-foreground text-sm">{PAGE_LABELS.intro}</p>
      </div>

      {setup.complete ? null : (
        <SetupChecklist academicYearId={selected?.id ?? null} status={setup} />
      )}

      <Section
        id={SETUP_ANCHORS.year}
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
            {/*
              `key` is what makes switching years safe. The switcher navigates
              softly, so React would otherwise reconcile these forms in place:
              `useActionState` would keep the previous year's state and the
              uncontrolled inputs would keep its typed values, while the actions
              below them are already bound to the new year's id — half-typed
              dates for one year, saved onto another. The key remounts them.
            */}
            <YearForm
              initialParity={
                frame?.[3].find((anchor) => anchor.date === selected.dateFrom)
                  ?.parity
              }
              key={selected.id}
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
          {/*
            Keyed for the same reason as the year form above. The prefixes are
            not decoration: these three are siblings in one children array, and
            a bare `selected.id` on all of them is a duplicate key, which React
            treats as unsupported — only one child per key is matched against
            the previous render, so the remount this comment is asking for is
            exactly what stops happening.
          */}
          <SemestersSection
            academicYearId={selected.id}
            key={`semesters-${selected.id}`}
            semesters={frame[0]}
          />
          <PeriodsSection
            academicYearId={selected.id}
            key={`periods-${selected.id}`}
            optionalMark={optionalMark}
            periods={frame[1]}
          />
          <RulesSection
            academicYearId={selected.id}
            key={`rules-${selected.id}`}
            optionalMark={optionalMark}
            rules={frame[2]}
          />
        </>
      ) : null}

      <BellsSection bells={bells} />

      {selected !== null && frame !== null ? (
        <ParitySection
          academicYearId={selected.id}
          anchors={frame[3]}
          key={selected.id}
          yearStart={selected.dateFrom}
        />
      ) : null}

      {/* Not while the gate is up: the calendar would send her straight back. */}
      {setup.complete ? (
        <p className="text-sm">
          <Link className="underline underline-offset-2" href="/calendar">
            {PAGE_LABELS.toCalendar}
          </Link>
        </p>
      ) : null}

      {/*
        Last, and never inside a condition: it compares this render with the
        previous one, and only a component the save does not remount can. The
        id tells this render from every other, so the completion notice lasts
        exactly as long as the render the completing save produced (T-041).
      */}
      <SetupProgress
        complete={setup.complete}
        next={next === null ? null : { label: next.label, href: next.href }}
        renderId={randomUUID()}
      />
    </div>
  );
}
