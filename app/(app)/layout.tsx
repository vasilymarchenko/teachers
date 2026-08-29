import { AppNav } from "@/components/navigation/app-nav";
import { requireUser } from "@/lib/auth/session";
import { getTeacher } from "@/lib/db/queries/teacher";

// The session is read per request; nothing here may be frozen into the build.
export const dynamic = "force-dynamic";

/**
 * The application shell — specification §8, overview §2.
 *
 * Everything a signed-in teacher sees lands here: the dark navigation panel and
 * the light work area. The feature route groups of overview §2 —
 * `(calendar)`, `(schedule)`, `(events)` — sit inside this group, while
 * `(auth)` and `print` are its siblings and therefore render without the
 * chrome. That is structural rather than a convention each layout has to
 * remember, which is what §7 requires of the printed pages.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The boundary (overview §8.3). The shell renders the teacher's own name, so
  // it reads data, so it starts here — and every page below it is behind the
  // same check.
  const { id: userId } = await requireUser();
  const teacher = await getTeacher(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AppNav teacherName={teacher?.name ?? "Учитель"} />
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
