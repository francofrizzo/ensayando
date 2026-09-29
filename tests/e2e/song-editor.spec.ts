import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

// Local Supabase deterministic service role key (as in seed.ts)
const service = createClient(
  "http://localhost:54321",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FIXTURES = join(import.meta.dirname, "fixtures");
const FIXTURE_URL =
  "http://localhost:54321/storage/v1/object/public/audio-files/test/track-guitar.mp3";
const PREFIX = "e2e-editor-";

// There is no R2 locally: sign, upload and download go through a fake bucket.
async function fakeStorage(page: Page) {
  let n = 0;
  await page.route("**/api/storage", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === "sign-upload") {
      n++;
      return route.fulfill({
        json: {
          key: `audio/${body.collectionId}/e2e-${Date.now()}-${n}.mp3`,
          url: `http://localhost:5173/__fake-r2/${n}`,
          headers: {}
        }
      });
    }
    if (body.action === "complete-upload") {
      return route.fulfill({ json: { url: FIXTURE_URL, size: 1234 } });
    }
    if (body.action === "download-audio") {
      const ids = body.trackIds as number[];
      return route.fulfill({
        json: { urls: Object.fromEntries(ids.map((id) => [id, FIXTURE_URL])) }
      });
    }
    return route.fulfill({ status: 204 });
  });
  await page.route("**/__fake-r2/**", (route) => route.fulfill({ status: 200 }));
}

test.afterAll(async () => {
  await service.from("songs").delete().like("slug", `${PREFIX}%`);
});

test.describe.configure({ mode: "serial" });

test("create a song from three audio files, then delete it", async ({ page }) => {
  await fakeStorage(page);
  const slug = `${PREFIX}${Date.now()}`;
  const title = `E2E Editor ${slug.slice(PREFIX.length)}`;

  await page.goto("/test-collection/nueva");
  await page.getByTestId("song-title-input").fill(title);
  // The address follows the title
  await expect(page.getByTestId("song-slug-input")).toHaveValue(
    `e2e-editor-${slug.slice(PREFIX.length)}`
  );
  await page.getByTestId("song-slug-input").fill(slug);

  await page
    .getByTestId("track-files-input")
    .setInputFiles(
      ["track-guitar.mp3", "track-vocals.mp3", "track-drums.mp3"].map((f) => join(FIXTURES, f))
    );

  // One track per file, named from the file ("track-" is shared, so it goes)
  const titles = page.getByTestId("track-title");
  await expect(titles).toHaveCount(3);
  await expect(titles.nth(0)).toHaveValue("Guitar");
  await expect(titles.nth(1)).toHaveValue("Vocals");
  await expect(titles.nth(2)).toHaveValue("Drums");

  // Guardar waits for the uploads
  const save = page.getByTestId("save-changes");
  await expect(save).toBeEnabled({ timeout: 15000 });
  await save.click();

  await expect(page).toHaveURL(new RegExp(`/test-collection/${slug}\\?editar=letra`), {
    timeout: 15000
  });

  const { data: song } = await service
    .from("songs")
    .select("id, visible, duration, audio_tracks(title, audio_file_key, order)")
    .eq("slug", slug)
    .single();
  expect(song).not.toBeNull();
  // New songs are born hidden
  expect(song!.visible).toBe(false);
  expect(song!.duration).toBeGreaterThan(0);
  const tracks = [...song!.audio_tracks].sort((a, b) => a.order - b.order);
  expect(tracks.map((t) => t.title)).toEqual(["Guitar", "Vocals", "Drums"]);
  expect(tracks.every((t) => t.audio_file_key?.startsWith("audio/"))).toBe(true);

  // Delete it from the Canción tab (the test user is admin)
  await page.getByTestId("edit-tab-cancion").click();
  await page.getByTestId("delete-song").click();
  await page.getByTestId("confirm-input").fill(title);
  await page.getByTestId("confirm-delete").click();
  await expect(page).not.toHaveURL(new RegExp(slug), { timeout: 15000 });

  const { data: gone } = await service.from("songs").select("id").eq("slug", slug);
  expect(gone).toEqual([]);
});

test("reorder with the keyboard, remove with undo, and discard", async ({ page }) => {
  await page.goto("/test-collection/test-song?editar=cancion");
  const titles = page.getByTestId("track-title");
  await expect(titles).toHaveCount(3, { timeout: 15000 });
  await expect(titles.nth(0)).toHaveValue("Guitar");

  // ⌥↓ on the handle moves the track down and keeps focus on it
  await page.getByTestId("track-handle").first().focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(titles.nth(0)).toHaveValue("Vocals");
  await expect(titles.nth(1)).toHaveValue("Guitar");
  await expect(page.getByTestId("save-status")).toContainText("Cambios sin guardar");

  // Remove, then undo from the toast
  await page.getByTestId("track-remove").nth(2).click();
  await expect(titles).toHaveCount(2);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(titles).toHaveCount(3);

  // Discard goes back to the saved order
  await page.getByTestId("discard-changes").click();
  await expect(titles.nth(0)).toHaveValue("Guitar");
  await expect(page.getByTestId("save-changes")).toBeDisabled();
});

test("reserved addresses are rejected while typing", async ({ page }) => {
  await page.goto("/test-collection/nueva");
  await page.getByTestId("song-slug-input").fill("ajustes");
  await expect(page.getByText("Esa dirección está reservada. Probá con otra.")).toBeVisible();
});

test("a track without audio blocks saving and says which", async ({ page }) => {
  await page.goto("/test-collection/test-song?editar=cancion");
  await expect(page.getByTestId("track-title")).toHaveCount(3, { timeout: 15000 });
  await page.getByTestId("add-track").click();
  await page.getByTestId("track-title").nth(3).fill("Coros");
  await page.getByTestId("save-changes").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "“Coros” le falta el audio" })
  ).toBeVisible();
  await page.getByTestId("discard-changes").click();
});
