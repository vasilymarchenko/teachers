import { expect, test } from "vitest";

// Deliberately failing: T-025 shows that branch protection blocks a pull
// request whose head commit has a red gate. The next commit removes this file.
test("T-025: the gate is red on purpose", () => {
  expect(1).toBe(2);
});
