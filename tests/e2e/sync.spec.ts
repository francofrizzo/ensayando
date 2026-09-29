import { expect, test } from "@playwright/test";

// Sincronizar: marking times with ↓ while the song plays.
// It saves, so it works on a song of its own (a copy of the seeded one), created and
// deleted here: the player specs read test-song in parallel.

const SLUG = "sincronizar-e2e";
const SONG = `/test-collection/${SLUG}`;
const SUPABASE_URL = "http://localhost:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};
const rest = `${SUPABASE_URL}/rest/v1`;

type SeedTrack = { title: string; color_key: string; order: number | null; audio_file_url: string; peaks: unknown };

test.beforeAll(async ({ request }) => {
  await request.delete(`${rest}/songs?slug=eq.${SLUG}`, { headers });
  const [source] = await (
    await request.get(
      `${rest}/songs?slug=eq.test-song&select=collection_id,lyrics,audio_tracks(title,color_key,order,audio_file_url,peaks)`,
      { headers }
    )
  ).json();
  const [song] = await (
    await request.post(`${rest}/songs`, {
      headers,
      data: {
        collection_id: source.collection_id,
        slug: SLUG,
        title: "Sincronizar e2e",
        visible: true,
        lyrics: source.lyrics
      }
    })
  ).json();
  await request.post(`${rest}/audio_tracks`, {
    headers,
    data: (source.audio_tracks as SeedTrack[]).map((track) => ({ ...track, song_id: song.id }))
  });
});

test.afterAll(async ({ request }) => {
  await request.delete(`${rest}/songs?slug=eq.${SLUG}`, { headers });
});

test("↓ marks each verse while playing, and the player uses the new times", async ({ page }) => {
  test.setTimeout(45000);
  await page.goto(`${SONG}?editar=sincronizar`);
  const panel = page.getByTestId("sync-panel");
  await expect(panel).toBeVisible({ timeout: 15000 });
  // Seeded: FIRST, SECOND, THIRD and LAST VERSE
  await expect(page.getByTestId("sync-verse")).toHaveCount(4);

  // Start from the first verse and play
  await page.getByTestId("sync-verse").first().click();
  await expect(page.getByTestId("sync-verse").first()).toHaveAttribute("data-state", "marcando");
  await expect(page.getByTestId("sync-play")).toBeEnabled();
  await page.getByTestId("sync-play").click();
  await expect(page.getByTestId("sync-play")).toHaveAttribute("aria-label", "Pausar");

  await page.waitForTimeout(900);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowDown");

  // Three marked verses show their new times; the cursor moved on to the fourth verse
  await expect(page.getByTestId("sync-new-times")).toBeVisible();
  const rows = page.getByTestId("sync-verse");
  await expect(rows.nth(0)).toHaveAttribute("data-state", "marcado");
  await expect(rows.nth(1)).toHaveAttribute("data-state", "marcado");
  await expect(rows.nth(2)).toHaveAttribute("data-state", "marcado");
  await expect(rows.nth(3)).toHaveAttribute("data-state", "marcando");
  const toSeconds = (clock: string) => {
    const [minutes, seconds] = clock.trim().split(":");
    return Number(minutes) * 60 + Number(seconds);
  };
  const first = toSeconds(await rows.nth(0).getByTestId("sync-verse-time").innerText());
  const second = toSeconds(await rows.nth(1).getByTestId("sync-verse-time").innerText());
  const third = toSeconds(await rows.nth(2).getByTestId("sync-verse-time").innerText());
  expect(second).toBeGreaterThan(first);
  expect(third).toBeGreaterThan(second);
  // Seeded times were 0.50, 1.50 and 3.00: these come from the marks
  expect([first, second, third]).not.toEqual([0.5, 1.5, 3]);

  // The tab shows it has changes, and saving clears them
  await expect(page.getByTestId("edit-tab-sincronizar").locator(".bg-warning")).toBeVisible();
  await page.getByTestId("save-changes").click();
  await expect(page.getByTestId("sync-new-times")).toBeHidden();

  // Back in the player, a verse clicked in the lyrics jumps to its marked time and lights up
  await page.getByTestId("exit-edit").click();
  await expect(page).not.toHaveURL(/editar=/);
  const secondVerse = page.getByText("SECOND VERSE", { exact: true });
  await secondVerse.click();
  await expect(secondVerse).toHaveAttribute("data-active", "true");
});

// Multicolumn lines: each column is its own voice, with its own lines and times.
const COLUMNS_SLUG = "sincronizar-columnas-e2e";

test.describe("multicolumn lines", () => {
  test.beforeAll(async ({ request }) => {
    await request.delete(`${rest}/songs?slug=eq.${COLUMNS_SLUG}`, { headers });
    const [source] = await (
      await request.get(`${rest}/songs?slug=eq.test-song&select=collection_id`, { headers })
    ).json();
    await request.post(`${rest}/songs`, {
      headers,
      data: {
        collection_id: source.collection_id,
        slug: COLUMNS_SLUG,
        title: "Columnas e2e",
        visible: true,
        lyrics: [
          [
            { text: "INTRO", start_time: 0.5 },
            [
              [{ text: "LEFT ONE" }, { text: "LEFT TWO" }],
              [{ text: "RIGHT ONE" }]
            ],
            { text: "OUTRO" }
          ]
        ]
      }
    });
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`${rest}/songs?slug=eq.${COLUMNS_SLUG}`, { headers });
  });

  test("lists every column verse on its own and marks one column without the other", async ({
    page
  }) => {
    await page.goto(`/test-collection/${COLUMNS_SLUG}?editar=sincronizar`);
    await expect(page.getByTestId("sync-panel")).toBeVisible({ timeout: 15000 });
    const rows = page.getByTestId("sync-verse");
    // Column by column, top to bottom, like the player reads them
    await expect(rows).toHaveText([/INTRO/, /LEFT ONE/, /LEFT TWO/, /RIGHT ONE/, /OUTRO/]);

    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("data-state", "marcando");
    await page.keyboard.press("ControlOrMeta+Comma");
    // Move the cursor away to see the verse's state
    await rows.nth(4).click();
    await expect(rows.nth(1)).toHaveAttribute("data-state", "marcado");
    // The other column keeps no time: marking one voice doesn't mark the others
    await expect(rows.nth(3)).toHaveAttribute("data-state", "sin-tiempo");
    await expect(rows.nth(2)).toHaveAttribute("data-state", "sin-tiempo");
  });
});
