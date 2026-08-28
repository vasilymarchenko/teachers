import { Button } from "@/components/ui/button";
import { today } from "@/lib/time/today";

// `today()` must be evaluated per request, not frozen into the build output.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Щоденник учителя</h1>
        <p className="text-muted-foreground text-sm">
          Застосунок ще будується. Сьогодні — {today()}.
        </p>
      </div>
      <div>
        <Button disabled>Календар з’явиться пізніше</Button>
      </div>
    </main>
  );
}
