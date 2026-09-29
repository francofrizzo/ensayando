import { expect, test } from "@playwright/test";

// Saving song details and lyrics in one go keeps both, and doesn't reload the player
// (regression: the song refetch used to reset the unsaved lyrics before they were
// written, and swap the screen for the loading state).
// Works on a copy of the seeded song, created and deleted here.

const SLUG = "guardar-juntos-e2e";
const RENAMED = "guardar-juntos-e2e-editada";
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

type SeedTrack = {
  title: string;
  color_key: string;
  order: number | null;
  audio_file_url: string;
  peaks: unknown;
};

const cleanup = async (request: import("@playwright/test").APIRequestContext) => {
  await request.delete(`${rest}/songs?slug=in.(${SLUG},${RENAMED})`, { headers });
};

test.beforeAll(async ({ request }) => {
  await cleanup(request);
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
        title: "Guardar juntos e2e",
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

test.afterAll(async ({ request }) => cleanup(request));

test("saving the title and a verse together keeps both, without reloading the player", async ({
  page,
  request
}) => {
  test.setTimeout(45000);
  await page.goto(`/test-collection/${SLUG}?editar=letra`);
  const firstVerse = page.locator("[data-lyrics-input]").first();
  await expect(firstVerse).toBeVisible({ timeout: 15000 });

  // Mark the dock: if the player remounts, the mark is gone.
  const dock = page.getByTestId("player-dock");
  await dock.evaluate((el) => el.setAttribute("data-e2e-mark", "same-player"));

  await firstVerse.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" guardado");
  const verseText = await firstVerse.inputValue();

  await page.getByTestId("edit-tab-cancion").click();
  const title = page.getByTestId("song-title-input");
  await title.fill("Guardar juntos e2e editada");

  await page.getByTestId("save-changes").click();

  // The address follows the new title, and the same player is still on screen.
  await expect(page).toHaveURL(new RegExp(`/${RENAMED}\\?editar=cancion`), { timeout: 15000 });
  await expect(page.getByTestId("player-dock")).toHaveAttribute("data-e2e-mark", "same-player");
  await expect(page.getByTestId("save-changes")).toBeDisabled();

  const [saved] = await (
    await request.get(`${rest}/songs?slug=eq.${RENAMED}&select=title,lyrics`, { headers })
  ).json();
  expect(saved.title).toBe("Guardar juntos e2e editada");
  expect(JSON.stringify(saved.lyrics)).toContain(verseText);

  await page.getByTestId("edit-tab-letra").click();
  await expect(page.locator("[data-lyrics-input]").first()).toHaveValue(verseText);
});
