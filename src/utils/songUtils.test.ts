import { describe, expect, it } from "vitest";

import { generateSlugFromTitle, validateSongForm } from "@/utils/songUtils";

describe("generateSlugFromTitle", () => {
  it("converts a basic title to a slug", () => {
    expect(generateSlugFromTitle("My Song Title")).toBe("my-song-title");
  });

  it("strips accented characters (ñ, á, é)", () => {
    expect(generateSlugFromTitle("Canción de España")).toBe("cancion-de-espana");
    expect(generateSlugFromTitle("Más allá")).toBe("mas-alla");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(generateSlugFromTitle("hello   world")).toBe("hello-world");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateSlugFromTitle("-hello world-")).toBe("hello-world");
    expect(generateSlugFromTitle("  hello  ")).toBe("hello");
  });

  it("strips special characters", () => {
    expect(generateSlugFromTitle("Rock & Roll! #1")).toBe("rock-roll-1");
    expect(generateSlugFromTitle("hello@world.com")).toBe("helloworldcom");
  });

  it("returns empty string for empty input", () => {
    expect(generateSlugFromTitle("")).toBe("");
  });
});

describe("validateSongForm", () => {
  const validForm = {
    title: "Test Song",
    slug: "test-song",
    audio_tracks: [{ id: 1 }]
  };

  it("passes for a valid form", () => {
    const result = validateSongForm(validForm);
    expect(result.isValid).toBe(true);
    expect(result.errors.title).toBe("");
    expect(result.errors.slug).toBe("");
    expect(result.errors.audio_tracks).toBe("");
  });

  it("fails when title is empty", () => {
    const result = validateSongForm({ ...validForm, title: "   " });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBeTruthy();
  });

  it("fails when slug is empty", () => {
    const result = validateSongForm({ ...validForm, slug: "" });
    expect(result.isValid).toBe(false);
    expect(result.errors.slug).toBeTruthy();
  });

  it("fails when slug contains invalid characters", () => {
    const result = validateSongForm({ ...validForm, slug: "Hello World!" });
    expect(result.isValid).toBe(false);
    expect(result.errors.slug).toContain("letras minúsculas");
  });

  it("fails when there are no audio tracks", () => {
    const result = validateSongForm({ ...validForm, audio_tracks: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors.audio_tracks).toBeTruthy();
  });

  it("reports multiple errors at once", () => {
    const result = validateSongForm({ title: "", slug: "", audio_tracks: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBeTruthy();
    expect(result.errors.slug).toBeTruthy();
    expect(result.errors.audio_tracks).toBeTruthy();
  });
});
