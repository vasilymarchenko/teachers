"use client";

import { Eraser, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ScheduleView } from "@/lib/db/schema/enums";
import { ROW_ACTION_LABELS } from "./labels";
import {
  rowClearReducer,
  rowIcon,
  rowLessonFields,
  type RowClearEvent,
  type RowClearState,
} from "./rowClear";

/**
 * The actions of one lesson row, at the end of its «3 · 10:15» header — T-046.
 *
 * One button that clears the row's lesson fields, and after a clear puts back
 * what it took away. It is one element in both roles, so the focus stays on it
 * when the role changes. It submits nothing: the lesson is removed by the
 * day's «Зберегти». Every field it changes gets a bubbling `input` event — the
 * contract `TrackedForm` reads a value set from code by (T-047).
 *
 * The rules are `rowClearReducer()`; this is only its DOM side. It renders
 * nothing until it has read the row in the browser, so the HTML a page with
 * JavaScript off keeps has no icon in it, and the form saves as it always has.
 */
export function RowActions({
  view,
  lessonNumber,
}: {
  view: ScheduleView;
  lessonNumber: number;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<RowClearState | null>(null);
  const names = rowLessonFields(view, lessonNumber);
  const namesKey = names.join(" ");

  const inputs = (): HTMLInputElement[] => {
    const form = anchorRef.current?.closest("form");
    if (!form) return [];
    return names.flatMap((name) => {
      const element = form.elements.namedItem(name);
      return element instanceof HTMLInputElement ? [element] : [];
    });
  };
  const read = () => inputs().map((input) => input.value);

  const apply = (event: RowClearEvent) =>
    setState((current) =>
      rowClearReducer(current ?? { values: read(), kept: null }, event),
    );

  // The teacher types, and React resets the form after a submission. `reset`
  // fires before the browser puts the defaults back, so the row is read a
  // microtask later — as `createChangeTracker()` does.
  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const onInput = () => apply({ type: "read", values: read() });
    const onReset = () =>
      queueMicrotask(() => apply({ type: "reset", values: read() }));
    form.addEventListener("input", onInput);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("reset", onReset);
    };
    // `names` is rebuilt every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  // Every render may carry new defaults without an event — another form's
  // save that changed what this row shows. Reading the row is cheap, and the
  // reducer returns the same state when nothing changed.
  useEffect(() => {
    apply({ type: "read", values: read() });
  });

  const activate = (event: RowClearEvent) => {
    if (state === null) return;
    const next = rowClearReducer(state, event);
    setState(next);
    inputs().forEach((input, index) => {
      const value = next.values[index] ?? "";
      if (input.value === value) return;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const icon = state === null ? null : rowIcon(state);
  const label =
    icon === "undo"
      ? ROW_ACTION_LABELS.undo(lessonNumber)
      : ROW_ACTION_LABELS.clear(lessonNumber);

  return (
    <span className="inline-flex size-6 shrink-0" ref={anchorRef}>
      {icon === null ? null : (
        <button
          aria-label={label}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => activate({ type: icon })}
          title={label}
          type="button"
        >
          {icon === "undo" ? (
            <Undo2 aria-hidden className="size-4" />
          ) : (
            <Eraser aria-hidden className="size-4" />
          )}
        </button>
      )}
    </span>
  );
}
