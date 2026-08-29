import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/auth/session";
import { getTeacher } from "@/lib/db/queries/teacher";
import { today } from "@/lib/time/today";

// `today()` and the session must be evaluated per request, not frozen into the
// build output.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The boundary (overview §8.3): the page reads data, so it starts here, and
  // the id it passes on is the one this call returned.
  const { id: userId } = await requireUser();
  const teacher = await getTeacher(userId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Щоденник учителя</h1>
        {/* No punctuation after the name: a teacher's name is normally
            written with initials and already ends in a full stop. */}
        <p className="text-muted-foreground text-sm">
          Вітаємо, {teacher?.name ?? "учителю"}
        </p>
        <p className="text-muted-foreground text-sm">
          Сьогодні — {today()}. Застосунок ще будується.
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}
