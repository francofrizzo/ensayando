import { describe, expect, it } from "vitest";

import { resolveGuard, type GuardInput } from "./index";

const base: GuardInput = {
  requiresAuth: false,
  isAuthenticated: false,
  isLoginPage: false,
  redirectQuery: undefined,
  fullPath: "/some-page"
};

describe("resolveGuard", () => {
  it("redirects to login when requiresAuth and not authenticated", () => {
    const result = resolveGuard({ ...base, requiresAuth: true, isAuthenticated: false, fullPath: "/protected" });
    expect(result).toEqual({ action: "redirect-to-login", redirect: "/protected" });
  });

  it("redirects after login with valid redirect query", () => {
    const result = resolveGuard({
      ...base,
      isLoginPage: true,
      isAuthenticated: true,
      redirectQuery: "/my-collection"
    });
    expect(result).toEqual({ action: "redirect-after-login", path: "/my-collection" });
  });

  it("redirects to / when redirect query is empty string (regression 451572b)", () => {
    const result = resolveGuard({
      ...base,
      isLoginPage: true,
      isAuthenticated: true,
      redirectQuery: ""
    });
    expect(result).toEqual({ action: "redirect-after-login", path: "/" });
  });

  it("redirects to / when redirect query is not a string", () => {
    const result = resolveGuard({
      ...base,
      isLoginPage: true,
      isAuthenticated: true,
      redirectQuery: undefined
    });
    expect(result).toEqual({ action: "redirect-after-login", path: "/" });
  });

  it("redirects to / when redirect query is an array", () => {
    const result = resolveGuard({
      ...base,
      isLoginPage: true,
      isAuthenticated: true,
      redirectQuery: ["/a", "/b"]
    });
    expect(result).toEqual({ action: "redirect-after-login", path: "/" });
  });

  it("proceeds for normal navigation", () => {
    const result = resolveGuard({ ...base, isAuthenticated: true });
    expect(result).toEqual({ action: "proceed" });
  });

  it("proceeds for non-auth page when not authenticated", () => {
    const result = resolveGuard({ ...base, requiresAuth: false, isAuthenticated: false });
    expect(result).toEqual({ action: "proceed" });
  });
});
