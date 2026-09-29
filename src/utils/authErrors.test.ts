import { describe, expect, it } from "vitest";

import { loginErrorMessage } from "./authErrors";

describe("loginErrorMessage", () => {
  it("translates wrong credentials", () => {
    expect(loginErrorMessage(new Error("Invalid login credentials"))).toMatch(/no coinciden/);
  });

  it("translates rate limits and network errors", () => {
    expect(loginErrorMessage(new Error("Request rate limit reached"))).toMatch(/demasiados intentos/);
    expect(loginErrorMessage(new TypeError("Failed to fetch"))).toMatch(/conexión/);
  });

  it("never shows an unknown English message", () => {
    expect(loginErrorMessage(new Error("Database error querying schema"))).toBe(
      "No se pudo iniciar sesión. Probá de nuevo en un momento."
    );
    expect(loginErrorMessage(undefined)).toMatch(/No se pudo iniciar sesión/);
  });
});
