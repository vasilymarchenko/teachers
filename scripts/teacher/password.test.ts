import { describe, expect, it } from "vitest";
import { typeKeys } from "./password";

/**
 * `readHidden()` itself needs a terminal in raw mode; what each key does to the
 * line is `typeKeys()`, which needs nothing.
 */
describe("a key typed at the hidden prompt", () => {
  it("keeps what was typed, across chunks, until Enter", () => {
    const first = typeKeys("", "пар");
    expect(first).toEqual({ state: "typing", value: "пар" });
    expect(typeKeys("пар", "оль-1\r")).toEqual({ state: "entered", value: "пароль-1" });
  });

  it("removes one character on Backspace", () => {
    expect(typeKeys("", "abd\u007fc")).toEqual({ state: "typing", value: "abc" });
  });

  it("is interrupted by Ctrl-C", () => {
    expect(typeKeys("abc", "\u0003")).toEqual({ state: "interrupted" });
  });

  it.each([
    ["Left arrow", "\u001b[D"],
    ["Delete", "\u001b[3~"],
    ["Home", "\u001b[H"],
    ["F5", "\u001b[15~"],
    ["Tab", "\t"],
    ["Ctrl-U", "\u0015"],
  ])("refuses %s rather than store it in the password", (_name, sequence) => {
    expect(typeKeys("abc", sequence)).toEqual({ state: "unusable" });
    expect(typeKeys("", `abc${sequence}d\r`)).toEqual({ state: "unusable" });
  });
});
