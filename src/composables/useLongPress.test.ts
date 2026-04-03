import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLongPress } from "@/composables/useLongPress";

// Mock platform detection — useLongPress imports isMac from @/utils/platform
vi.mock("@/utils/platform", () => ({ isMac: false }));

function setup(duration = 500) {
  const tap = vi.fn();
  const longPress = vi.fn();
  const handlers = useLongPress({ tap, longPress }, duration);
  return { tap, longPress, handlers };
}

const fakeTouchEvent = () => ({ preventDefault: vi.fn() }) as unknown as TouchEvent;
const fakeMouseEvent = (opts: Partial<MouseEvent> = {}) =>
  ({ preventDefault: vi.fn(), shiftKey: false, ctrlKey: false, metaKey: false, ...opts }) as unknown as MouseEvent;

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires tap on quick touchstart + touchend", () => {
    const { tap, longPress, handlers } = setup();
    handlers.touchstart(fakeTouchEvent());
    vi.advanceTimersByTime(100); // well before 500ms
    handlers.touchend();
    expect(tap).toHaveBeenCalledWith(false);
    expect(longPress).not.toHaveBeenCalled();
  });

  it("fires longPress after holding for duration", () => {
    const { tap, longPress, handlers } = setup();
    handlers.touchstart(fakeTouchEvent());
    vi.advanceTimersByTime(500);
    expect(longPress).toHaveBeenCalledOnce();
    // touchend after long press should NOT fire tap
    handlers.touchend();
    expect(tap).not.toHaveBeenCalled();
  });

  it("prevents ghost tap: click after long press is suppressed", () => {
    const { tap, longPress, handlers } = setup();
    handlers.touchstart(fakeTouchEvent());
    vi.advanceTimersByTime(500);
    expect(longPress).toHaveBeenCalledOnce();
    handlers.touchend();

    const clickEvent = fakeMouseEvent();
    handlers.click(clickEvent);
    expect(clickEvent.preventDefault).toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
  });

  it("fires tap on normal click (no touch)", () => {
    const { tap, longPress, handlers } = setup();
    handlers.click(fakeMouseEvent());
    expect(tap).toHaveBeenCalledWith(false);
    expect(longPress).not.toHaveBeenCalled();
  });

  it("fires longPress on ctrl+click (non-Mac)", () => {
    const { tap, longPress, handlers } = setup();
    handlers.click(fakeMouseEvent({ ctrlKey: true }));
    expect(longPress).toHaveBeenCalledOnce();
    expect(tap).not.toHaveBeenCalled();
  });

  it("forwards shiftKey to tap", () => {
    const { tap, handlers } = setup();
    handlers.click(fakeMouseEvent({ shiftKey: true }));
    expect(tap).toHaveBeenCalledWith(true);
  });

  it("resets state on touchcancel", () => {
    const { tap, longPress, handlers } = setup();
    handlers.touchstart(fakeTouchEvent());
    vi.advanceTimersByTime(200);
    handlers.touchcancel();
    vi.advanceTimersByTime(500); // timer should be cleared
    expect(longPress).not.toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
  });
});
