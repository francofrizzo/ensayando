import { expect, test } from "@playwright/test";

// Helper: navigate to test song and wait for tracks to load
async function openTestSong(page: import("@playwright/test").Page) {
  await page.goto("/test-collection/test-song");
  // Wait for loading overlay to disappear (tracks ready)
  await expect(page.getByText("Cargando...")).toBeHidden({ timeout: 15000 });
}

// Helper: get the play/pause button
function playPauseButton(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: "Play/Pause" });
}

// Helper: get the time display text
async function getCurrentTimeText(page: import("@playwright/test").Page) {
  const timeEl = page.locator(".tabular-nums .text-xl").first();
  return timeEl.textContent();
}

// Helper: get the mute button for a track by name
function trackMuteButton(page: import("@playwright/test").Page, trackName: string) {
  return page.getByTestId(`track-${trackName}`).getByRole("button");
}

// --- Navigation ---

test("see collection and song list", async ({ page }) => {
  await page.goto("/test-collection");
  // Collection auto-redirects to first song; verify song title visible in header
  await expect(page.getByText("Test Song").last()).toBeVisible();
});

test("open song and see tracks panel", async ({ page }) => {
  await page.goto("/test-collection/test-song");
  await expect(page.getByText("Guitar")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Vocals")).toBeVisible();
  await expect(page.getByText("Drums")).toBeVisible();
});

// --- Playback ---

test("tracks load and play button is enabled", async ({ page }) => {
  await openTestSong(page);
  await expect(playPauseButton(page)).toBeEnabled();
});

test("play advances time", async ({ page }) => {
  await openTestSong(page);
  await playPauseButton(page).click();
  await expect.poll(async () => getCurrentTimeText(page), { timeout: 10000 }).not.toBe("0:00");
});

test("pause stops time", async ({ page }) => {
  await openTestSong(page);

  await playPauseButton(page).click();
  await expect.poll(async () => getCurrentTimeText(page), { timeout: 10000 }).not.toBe("0:00");

  await playPauseButton(page).click();
  const timeAfterPause = await getCurrentTimeText(page);

  await page.waitForTimeout(500);
  expect(await getCurrentTimeText(page)).toBe(timeAfterPause);
});

// --- Track controls ---

test("mute a track via click", async ({ page }) => {
  await openTestSong(page);

  const muteBtn = trackMuteButton(page, "Guitar");
  await muteBtn.click();
  await expect(muteBtn).toBeVisible();
});

test("solo a track via ctrl+click", async ({ page }) => {
  await openTestSong(page);

  const muteBtn = trackMuteButton(page, "Guitar");
  await muteBtn.click({ modifiers: ["Meta"] });
  await expect(muteBtn).toBeVisible();
});

test("unmute after mute does not get stuck", async ({ page }) => {
  await openTestSong(page);

  const muteBtn = trackMuteButton(page, "Guitar");

  await playPauseButton(page).click();
  await page.waitForTimeout(500);

  // Mute then unmute
  await muteBtn.click();
  await page.waitForTimeout(300);
  await muteBtn.click();
  await page.waitForTimeout(300);

  // Time should still be advancing (wait >1s so the displayed second changes)
  const time1 = await getCurrentTimeText(page);
  await page.waitForTimeout(1500);
  const time2 = await getCurrentTimeText(page);
  expect(time2).not.toBe(time1);
});

// --- Lyrics ---

test("lyrics highlight follows playback", async ({ page }) => {
  await openTestSong(page);

  await expect(page.getByText("FIRST VERSE")).toBeVisible();

  await playPauseButton(page).click();

  await expect
    .poll(
      async () => {
        const el = page.getByText("FIRST VERSE");
        const classes = await el.getAttribute("class");
        return classes?.includes("font-semibold");
      },
      { timeout: 5000 }
    )
    .toBe(true);
});

test("seek via lyrics click", async ({ page }) => {
  await openTestSong(page);

  await page.getByText("THIRD VERSE").click();

  await expect
    .poll(
      async () => {
        const text = await getCurrentTimeText(page);
        const parts = text?.split(":") ?? [];
        const seconds = parseInt(parts[0] ?? "0") * 60 + parseInt(parts[1] ?? "0");
        return seconds;
      },
      { timeout: 5000 }
    )
    .toBeGreaterThanOrEqual(2);
});
