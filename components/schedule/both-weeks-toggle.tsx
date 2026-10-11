import { Link2, Link2Off } from "lucide-react";
import { templateBothWeeksField } from "@/lib/validation/templateDay";
import { BOTH_WEEKS_LABELS } from "./labels";

/**
 * A row's «в обох тижнях» toggle (T-043, ADR-025): a native checkbox, drawn as
 * an icon, so it submits with JavaScript off.
 *
 * The checkbox is visually hidden but stays the control — focus, keyboard and
 * the accessible name are its own — and the `<label>` around it is the 24×24
 * hit area the icon is drawn in. On is a filled chip in the primary colour with
 * a linked icon; off is an outlined, muted chip with an unlinked one, so the
 * two differ in shape as well as colour. Below `md`, where the form is the
 * one-day view, the words are shown beside the icon; from `md` up the icon
 * stands alone and the words are its hover hint.
 */
export function BothWeeksToggle({
  lessonNumber,
  defaultChecked,
}: {
  lessonNumber: number;
  defaultChecked: boolean;
}) {
  const label = BOTH_WEEKS_LABELS.toggle(lessonNumber);

  return (
    <label
      className="text-muted-foreground inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 text-xs"
      title={label}
    >
      <input
        aria-label={label}
        className="peer sr-only"
        data-both-toggle=""
        defaultChecked={defaultChecked}
        name={templateBothWeeksField(lessonNumber)}
        type="checkbox"
      />
      <span className="border-border peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-checked:[&>.off]:hidden [&>.on]:hidden peer-checked:[&>.on]:block">
        <Link2Off aria-hidden className="off size-4" />
        <Link2 aria-hidden className="on size-4" />
      </span>
      <span aria-hidden className="md:hidden">
        {BOTH_WEEKS_LABELS.short}
      </span>
    </label>
  );
}
