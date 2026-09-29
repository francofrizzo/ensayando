import { describe, expect, it } from "vitest";

import { collectionSlugError, RESERVED_COLLECTION_SLUGS } from "./collectionSlug";

describe("collectionSlugError", () => {
  it("accepts ordinary addresses", () => {
    expect(collectionSlugError("coro-del-puerto")).toBe("");
  });

  it("rejects empty and malformed addresses", () => {
    expect(collectionSlugError("")).not.toBe("");
    expect(collectionSlugError("Coro Puerto")).not.toBe("");
  });

  it.each(RESERVED_COLLECTION_SLUGS)("rejects the reserved address %s", (slug) => {
    expect(collectionSlugError(slug)).toMatch(/reservada/);
  });
});
