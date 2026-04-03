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
  return page.getByTestId("time-display").textContent();
}

// Helper: get the mute button for a track by name
function trackMuteButton(page: import("@playwright/test").Page, trackName: string) {
  return page.getByTestId(`track-${trackName}`).getByRole("button");
}

// --- Navigation ---

test("collection auto-redirects to first song", async ({ page }) => {
  await page.goto("/test-collection");
  await expect(page.getByTestId("song-title")).toBeVisible();
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

  // Poll to confirm time stays frozen
  await expect
    .poll(async () => getCurrentTimeText(page), {
      intervals: [200, 200, 200],
      timeout: 2000
    })
    .toBe(timeAfterPause);
});

// --- Track controls ---

test("mute a track via click", async ({ page }) => {
  await openTestSong(page);

  await trackMuteButton(page, "Guitar").click();
  await expect(page.getByTestId("track-Guitar")).toHaveAttribute("data-muted", "true");
});

test("solo a track via ctrl+click", async ({ page }) => {
  await openTestSong(page);

  await trackMuteButton(page, "Guitar").click({ modifiers: ["ControlOrMeta"] });

  // Guitar stays unmuted, others get muted
  await expect(page.getByTestId("track-Guitar")).not.toHaveAttribute("data-muted");
  await expect(page.getByTestId("track-Vocals")).toHaveAttribute("data-muted", "true");
  await expect(page.getByTestId("track-Drums")).toHaveAttribute("data-muted", "true");
});

test("unmute after mute does not get stuck", async ({ page }) => {
  await openTestSong(page);

  const muteBtn = trackMuteButton(page, "Guitar");
  const track = page.getByTestId("track-Guitar");

  await playPauseButton(page).click();
  await expect.poll(async () => getCurrentTimeText(page), { timeout: 5000 }).not.toBe("0:00");

  // Mute and verify
  await muteBtn.click();
  await expect(track).toHaveAttribute("data-muted", "true");

  // Unmute and verify
  await muteBtn.click();
  await expect(track).not.toHaveAttribute("data-muted");

  // Time should still be advancing
  const time1 = await getCurrentTimeText(page);
  await expect.poll(async () => getCurrentTimeText(page), { timeout: 5000 }).not.toBe(time1);
});

// --- Lyrics ---

test("lyrics highlight follows playback", async ({ page }) => {
  await openTestSong(page);

  await expect(page.getByText("FIRST VERSE")).toBeVisible();

  await playPauseButton(page).click();

  // FIRST VERSE should become active around 0.5s
  await expect(page.getByText("FIRST VERSE")).toHaveAttribute("data-active", "true", {
    timeout: 5000
  });
});

test("seek via lyrics click", async ({ page }) => {
  await openTestSong(page);

  await page.getByText("THIRD VERSE").click();

  // Time should jump to ~3.0
  await expect
    .poll(
      async () => {
        const text = await getCurrentTimeText(page);
        const parts = text?.split(":") ?? [];
        const seconds = parseInt(parts[0] ?? "0") * 60 + parseInt(parts[1] ?? "0");
        return seconds;
      },
      { timeout: 10000 }
    )
    .toBeGreaterThanOrEqual(2);
});
