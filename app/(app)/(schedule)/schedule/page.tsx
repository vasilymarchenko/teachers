import Link from "next/link";
import { BoundaryForm } from "@/components/schedule/boundary-form";
import { CopyParityForm } from "@/components/schedule/copy-parity-form";
import {
  BOUNDARY_SECTION,
  COPY_SECTION,
  NO_BELLS,
  PAGE_LABELS,
  VERSION_SECTION,
} from "@/components/schedule/labels";
import { lessonRows } from "@/components/schedule/lessonRows";
import { pickTemplateSelection } from "@/components/schedule/selection";
import { TemplateSwitchers } from "@/components/schedule/switchers";
import { VersionNotice } from "@/components/schedule/version-notice";
import { WeekGrid } from "@/components/schedule/week-grid";
import { Section } from "@/components/year/section";
import { requireUser } from "@/lib/auth/session";
import { getBellSchedule } from "@/lib/db/queries/bells";
import {
  getTemplateVersionInForce,
  listTemplateVersions,
} from "@/lib/db/queries/templateEditor";
import { weekdayOf } from "@/lib/domain/schedule/calendarRules";
import { today } from "@/lib/time/today";
import type { TemplateSearchParams } from "@/components/schedule/selection";

// The teacher's own data, read per request; nothing may be frozen into the
// build.
export const dynamic = "force-dynamic";

/**
 * The weekly template editor — specification §5.1 and §5.2, overview §3.2.
 *
 * One `view` and one parity week at a time, said in the URL, because the two
 * views have different fields and the two weeks are independent sets of slots
 * (overview §3.3, schema §4.8). Which day is on a narrow screen is in the URL
 * too (overview §10.2).
 *
 * Everything the editor writes goes through the copy-on-write path of
 * `lib/actions/scheduleTemplate.ts`, whose cut is `today()`. This screen
 * therefore only ever shows the version in force **today**: a version that has
 * already ended is history and is listed but not edited, and a past day is a
 * `DayOverride` in the calendar (specification §5.3) — which is what
 * `VersionNotice` says out loud.
 *
 * The forms are client components, each with its own `useActionState`; every
 * read happens here.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<TemplateSearchParams>;
}) {
  // The boundary first, before anything reads (overview §8.3).
  const { id: userId } = await requireUser();

  const params = await searchParams;
  const cutAt = today();
  const selection = pickTemplateSelection(params, weekdayOf(cutAt));

  const [bells, current, versions] = await Promise.all([
    getBellSchedule(userId),
    getTemplateVersionInForce(userId, selection.view, cutAt),
    listTemplateVersions(userId, selection.view),
  ]);

  const slots = current?.slots ?? [];
  const rows = lessonRows(bells, slots);
  const otherParity =
    selection.parity === "NUMERATOR" ? "DENOMINATOR" : "NUMERATOR";

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_LABELS.title}</h1>
        <p className="text-muted-foreground text-sm">{PAGE_LABELS.intro}</p>
      </div>

      <TemplateSwitchers selection={selection} />

      {bells.length === 0 && slots.length === 0 ? (
        <Section title={NO_BELLS.title} description={NO_BELLS.description}>
          <p className="text-sm">
            <Link className="underline underline-offset-2" href="/year">
              {NO_BELLS.link}
            </Link>
          </p>
        </Section>
      ) : (
        <>
          {/*
            `key` remounts the seven forms when the switches move. The switchers
            navigate softly, so React would otherwise reconcile them in place:
            `useActionState` would keep the previous week's state and the
            uncontrolled inputs its typed values, while the actions below them
            are already bound to another view and parity — the same trap the
            year setup's forms have.
          */}
          <WeekGrid
            key={`${selection.view}-${selection.parity}`}
            parity={selection.parity}
            rows={rows}
            selected={selection.weekday}
            slots={slots}
            view={selection.view}
          />

          <Section
            title={COPY_SECTION.title}
            description={COPY_SECTION.description}
          >
            <CopyParityForm
              from={selection.parity}
              key={`copy-${selection.view}-${selection.parity}`}
              to={otherParity}
              view={selection.view}
            />
          </Section>
        </>
      )}

      <Section
        title={BOUNDARY_SECTION.title}
        description={BOUNDARY_SECTION.description}
      >
        <BoundaryForm
          boundaryKind={current?.boundaryKind}
          key={`boundary-${selection.view}`}
          validTo={current?.validTo}
          view={selection.view}
        />
      </Section>

      <Section
        title={VERSION_SECTION.title}
        description={VERSION_SECTION.description}
      >
        <VersionNotice today={cutAt} versions={versions} />
      </Section>

      <p className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-2" href="/year">
          {PAGE_LABELS.toYear}
        </Link>
        <Link className="underline underline-offset-2" href="/calendar">
          {PAGE_LABELS.toCalendar}
        </Link>
      </p>
    </div>
  );
}
