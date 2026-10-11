import { describe, expect, it } from "vitest";
import {
  rowClearReducer,
  rowIcon,
  rowLessonFields,
  type RowClearEvent,
  type RowClearState,
} from "./rowClear";

/**
 * T-046: a lesson row is cleared by an icon, and the clear can be undone
 * before the save.
 *
 * The suite has no DOM (`vitest.config.mts`); `RowActions` only reads the
 * row's inputs into `rowClearReducer()` and writes back what it returns, so
 * the rules are tested here, on the values the inputs would hold.
 */
function run(start: readonly string[], events: RowClearEvent[]): RowClearState {
  return events.reduce(rowClearReducer, { values: start, kept: null });
}

describe("which rows show the clear icon", () => {
  it("shows it on a row with at least one non-empty lesson field", () => {
    expect(rowIcon(run(["Фізика", "7-А"], []))).toBe("clear");
    expect(rowIcon(run(["", "7-А"], []))).toBe("clear");
    expect(rowIcon(run(["", "", "", "Зошит"], []))).toBe("clear");
  });

  it("shows nothing on a row whose lesson fields are all empty", () => {
    expect(rowIcon(run(["", ""], []))).toBeNull();
    expect(rowIcon(run(["", "", "", ""], []))).toBeNull();
  });

  it("shows nothing on a row emptied by hand, which has nothing to undo", () => {
    const state = run(["Фізика", "7-А"], [
      { type: "read", values: ["", "7-А"] },
      { type: "read", values: ["", ""] },
    ]);
    expect(rowIcon(state)).toBeNull();
  });
});

describe("what the clear touches", () => {
  it("names only the lesson fields of that row, for each view", () => {
    expect(rowLessonFields("OWN", 3)).toEqual([
      "slot-3-subject",
      "slot-3-className",
    ]);
    expect(rowLessonFields("CLASS", 3)).toEqual([
      "slot-3-subject",
      "slot-3-teacherName",
      "slot-3-zoomLink",
      "slot-3-note",
    ]);
  });

  it("empties every one of those fields and offers the undo", () => {
    const state = run(["Фізика", "Петренко", "", "Зошит"], [{ type: "clear" }]);
    expect(state.values).toEqual(["", "", "", ""]);
    expect(rowIcon(state)).toBe("undo");
  });

  it("keeps the undo when the cleared row is read back empty", () => {
    // `RowActions` dispatches `input` on each field it emptied; the row is
    // read again on each one.
    const state = run(["Фізика", "7-А"], [
      { type: "clear" },
      { type: "read", values: ["", ""] },
    ]);
    expect(rowIcon(state)).toBe("undo");
  });
});

describe("the undo", () => {
  it("returns an edited row to the edited values, not to the rendered ones", () => {
    const state = run(["Фізика", "7-А"], [
      { type: "read", values: ["Фізика", "7-Б"] },
      { type: "clear" },
      { type: "undo" },
    ]);
    expect(state.values).toEqual(["Фізика", "7-Б"]);
    expect(rowIcon(state)).toBe("clear");
  });

  it("is replaced by the clear icon once the teacher types into the row", () => {
    const typed = run(["Фізика", "7-А"], [
      { type: "clear" },
      { type: "read", values: ["Х", ""] },
    ]);
    expect(rowIcon(typed)).toBe("clear");
    expect(typed.kept).toBeNull();

    // Emptied by hand afterwards, the row has nothing left to put back.
    expect(rowIcon(rowClearReducer(typed, { type: "read", values: ["", ""] })))
      .toBeNull();
  });

  it("is gone after the form is submitted and reset", () => {
    const state = run(["Фізика", "7-А"], [
      { type: "clear" },
      { type: "reset", values: ["", ""] },
    ]);
    expect(rowIcon(state)).toBeNull();
  });
});
