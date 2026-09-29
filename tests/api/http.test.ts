import { describe, expect, it } from "vitest";

import { ApiError, requestOrigin, type VercelRequest } from "../../server/http";

const request = (origin?: string): VercelRequest => ({
  headers: origin ? { origin } : {},
  body: null
});

describe("requestOrigin", () => {
  it("uses APP_URL in production and ignores the Origin header", () => {
    const env = { VERCEL_ENV: "production", APP_URL: "https://ensayando.com.ar/" };
    expect(requestOrigin(request("https://evil.example"), env)).toBe("https://ensayando.com.ar");
  });

  it("fails closed in production without APP_URL", () => {
    expect(() => requestOrigin(request("https://evil.example"), { VERCEL_ENV: "production" })).toThrow(
      ApiError
    );
  });

  it("never trusts an arbitrary origin outside production", () => {
    expect(requestOrigin(request("https://evil.example"), {})).toBeUndefined();
    expect(
      requestOrigin(request("https://evil.example"), { APP_URL: "https://preview.example" })
    ).toBe("https://preview.example");
  });

  it("accepts local dev origins and the configured one", () => {
    expect(requestOrigin(request("http://localhost:5173"), {})).toBe("http://localhost:5173");
    expect(requestOrigin(request("http://127.0.0.1:4000"), {})).toBe("http://127.0.0.1:4000");
    expect(
      requestOrigin(request("https://preview.example"), { APP_URL: "https://preview.example" })
    ).toBe("https://preview.example");
  });
});
