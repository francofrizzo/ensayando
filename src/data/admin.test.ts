import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { adminErrorMessage } from "@/data/admin";

describe("adminErrorMessage", () => {
  it("translates database function codes", () => {
    expect(adminErrorMessage({ message: "LAST_ADMIN" })).toBe(
      "La colección tiene que tener al menos un admin."
    );
    expect(adminErrorMessage({ message: "ALREADY_MEMBER" })).toBe(
      "Esa persona ya está en la colección."
    );
  });

  it("explains duplicated and reserved addresses", () => {
    expect(adminErrorMessage({ code: "23505", message: "duplicate key" })).toBe(
      "Esa dirección ya está en uso."
    );
    expect(
      adminErrorMessage({ code: "23514", message: 'violates check constraint "songs_slug_not_reserved"' })
    ).toBe("Esa dirección está reservada. Probá con otra.");
  });

  it("falls back to a generic message", () => {
    expect(adminErrorMessage({ message: "connection reset" })).toBe("Algo falló. Probá de nuevo.");
    expect(adminErrorMessage(null)).toBe("");
  });
});
