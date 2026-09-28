import { describe, expect, it } from "vitest";

import { collectionIdFromKey, extensionForUpload, MAX_AUDIO_BYTES, validateUpload } from "./r2";

describe("R2 storage validation", () => {
  it("accepts the largest valid audio and rejects the first oversized byte", () => {
    expect(() => validateUpload("audio", "audio/mpeg", MAX_AUDIO_BYTES)).not.toThrow();
    expect(() => validateUpload("audio", "audio/mpeg", MAX_AUDIO_BYTES + 1)).toThrow("100 MB");
  });

  it("does not trust an audio extension when the signed content type is invalid", () => {
    expect(() => validateUpload("audio", "application/octet-stream", 1024)).toThrow("no permitido");
  });

  it("normalizes known audio extensions and falls back safely", () => {
    expect(extensionForUpload("audio", "Voz.M4A")).toBe("m4a");
    expect(extensionForUpload("audio", "archivo.exe")).toBe("mp3");
  });

  it("only extracts collection IDs from canonical keys", () => {
    expect(collectionIdFromKey("audio/42/9d2f1c61-a8bf-4a42-a456-807a2b785abc.ogg", "audio")).toBe(
      42
    );
    expect(collectionIdFromKey("artwork/42/file.jpg", "audio")).toBeNull();
    expect(collectionIdFromKey("audio/../42/file.mp3", "audio")).toBeNull();
  });
});
