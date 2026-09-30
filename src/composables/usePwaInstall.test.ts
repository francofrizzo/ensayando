import { describe, expect, it } from "vitest";

import { isInstalledPwa, isIOSDevice, isMobileDevice } from "./usePwaInstall";

const device = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });

describe("PWA install detection", () => {
  it("recognizes iPhones and iPads that request the desktop site", () => {
    expect(isIOSDevice(device("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5))).toBe(
      true
    );
    expect(isIOSDevice(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5))).toBe(true);
  });

  it("offers the mobile UI on Android but not on a desktop Mac", () => {
    expect(isMobileDevice(device("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", 5))).toBe(
      true
    );
    expect(isMobileDevice(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0))).toBe(
      false
    );
  });

  it("recognizes standalone mode in Chromium and iOS", () => {
    expect(isInstalledPwa({ userAgent: "Android" }, true)).toBe(true);
    expect(isInstalledPwa({ userAgent: "iPhone", standalone: true }, false)).toBe(true);
    expect(isInstalledPwa({ userAgent: "iPhone", standalone: false }, false)).toBe(false);
  });
});
