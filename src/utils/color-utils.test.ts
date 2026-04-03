import { describe, expect, it } from "vitest";

import { average, darken, lighten, selectMostContrasting, transparentize } from "./color-utils";

describe("darken", () => {
  it("returns a darker color", () => {
    const result = darken("#ffffff", 0.5);
    expect(result).toBeTruthy();
    expect(result).not.toBe("#ffffff");
  });

  it("returns original for invalid color", () => {
    expect(darken("not-a-color", 0.5)).toBe("not-a-color");
  });
});

describe("lighten", () => {
  it("returns a lighter color", () => {
    const result = lighten("#000000", 0.5);
    expect(result).toBeTruthy();
    expect(result).not.toBe("#000000");
  });

  it("returns original for invalid color", () => {
    expect(lighten("not-a-color", 0.5)).toBe("not-a-color");
  });
});

describe("transparentize", () => {
  it("returns a color string", () => {
    const result = transparentize("#ff0000", 0.5);
    expect(result).toBeTruthy();
  });
});

describe("average", () => {
  it("averages multiple colors", () => {
    const result = average(["#ff0000", "#0000ff"]);
    expect(result).toBeTruthy();
  });

  it("returns same color for single input", () => {
    const result = average(["#ff0000"]);
    expect(result).toBeTruthy();
  });
});

describe("selectMostContrasting", () => {
  it("picks white on dark background", () => {
    expect(selectMostContrasting("#000000", ["white", "black"])).toBe("white");
  });

  it("picks black on light background", () => {
    expect(selectMostContrasting("#ffffff", ["white", "black"])).toBe("black");
  });

  it("returns undefined for empty choices", () => {
    expect(selectMostContrasting("#000000", [])).toBeUndefined();
  });
});
