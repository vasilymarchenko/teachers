"use client";

import { Button } from "@/components/ui/button";

/**
 * The «Видалити» button of a row.
 *
 * It lives **inside** the row's own form and overrides where that form
 * submits with `formAction`, because a nested `<form>` is invalid HTML and a
 * sibling one would not line up with the row. Two attributes carry the
 * behaviour:
 *
 *  - `formNoValidate`, so the browser does not demand that the required fields
 *    of the row be filled in before it can be deleted;
 *  - the `confirm()`, because deleting a year takes its semesters, periods,
 *    rules and anchors with it. With JavaScript off there is no dialogue and
 *    the delete goes straight through — the accepted cost of a screen that
 *    works without it.
 */
export function DeleteButton({
  action,
  confirm,
  label,
}: {
  /**
   * Where the delete goes. Omitted when the whole form is the delete, which is
   * the case for a row that has nothing to edit.
   */
  action?: () => void | Promise<void>;
  confirm: string;
  label: string;
}) {
  return (
    <Button
      type="submit"
      variant="ghost"
      formAction={action}
      formNoValidate
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}
