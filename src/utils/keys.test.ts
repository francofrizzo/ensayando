import { describe, expect, it } from "vitest";

import { isTypingTarget, prettyKeyParts } from "./keys";

describe("prettyKeyParts", () => {
  it("prints modifier and editing keys as symbols", () => {
    expect(prettyKeyParts(["⌘", "Shift", "Enter"])).toEqual(["⌘", "⇧", "↵"]);
    expect(prettyKeyParts(["⌘", "Backspace"])).toEqual(["⌘", "⌫"]);
    expect(prettyKeyParts(["F1"])).toEqual(["F1"]);
  });
});

describe("isTypingTarget", () => {
  it("detects inputs and textareas, including their children", () => {
    const textarea = document.createElement("textarea");
    const div = document.createElement("div");
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
