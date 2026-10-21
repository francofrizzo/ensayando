import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

// Read only the disposable local stack's credentials, never production secrets.
const local = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  })
);
const service = createClient("http://localhost:54321", local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const slug = `autoplay-${Date.now().toString(36)}`;
let collectionId: number;

test.beforeAll(async () => {
  const { data: source } = await service
    .from("songs")
    .select("collection_id,audio_tracks(audio_file_url)")
    .eq("slug", "test-song")
    .single()
    .throwOnError();
  const { data: member } = await service
    .from("user_collections")
    .select("user_id")
    .eq("collection_id", source!.collection_id)
    .eq("role", "admin")
    .single()
    .throwOnError();
  const { data: collection } = await service
    .from("collections")
    .insert({
      slug,
      title: "Ensayo continuo",
      visibility: "private",
      hue: 260,
      track_colors: { voice: { hue: 20, intensity: "media" }, piano: { neutral: true } }
    })
    .select("id")
    .single()
    .throwOnError();
  collectionId = collection!.id;
  await service
    .from("user_collections")
    .insert({ collection_id: collectionId, user_id: member!.user_id, role: "admin" })
    .throwOnError();
  for (let i = 1; i <= 2; i++) {
    const { data: song } = await service
      .from("songs")
      .insert({
        collection_id: collectionId,
        slug: `cancion-${i}`,
        title: `Canción ${i}`,
        order: i,
        visible: true,
        lyrics: [[{ text: `CANCIÓN ${i}` }]]
      })
      .select("id")
      .single()
      .throwOnError();
    await service
      .from("audio_tracks")
      .insert([
        {
          song_id: song!.id,
          title: "Voz",
          order: 1,
          kind: "voice",
          color_key: "voice",
          audio_file_url: source!.audio_tracks[0]!.audio_file_url
        },
        {
          song_id: song!.id,
          title: "Piano",
          order: 2,
          kind: "instrumental",
          color_key: "piano",
          audio_file_url: source!.audio_tracks[0]!.audio_file_url
        }
      ])
      .throwOnError();
    if (i === 2) {
      await service
        .from("audio_tracks")
        .update({
          peaks: { duration: 5, channels: [[0.1, 0.2, 0.1, 0.2, 0.1]] }
        })
        .eq("song_id", song!.id)
        .throwOnError();
    }
  }
});

test.afterAll(async () => {
  if (collectionId)
    await service.from("collections").delete().eq("id", collectionId).throwOnError();
});

const play = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Play/Pause" });
const autoplay = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Reproducción continua", exact: true });

test("autoplay advances once, restores the next mix, plays it, and stops at the collection end", async ({
  page
}) => {
  test.setTimeout(45000);
  await page.route("**/storage/v1/object/public/audio-files/test/*.mp3", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto(`/${slug}/cancion-2`);
  await expect(play(page)).toHaveAttribute("data-ready", "true", { timeout: 15000 });
  if (await page.getByTestId("ios-playback-notice").isVisible()) {
    await page.getByRole("button", { name: "Entendido", exact: true }).click();
  }
  await page.getByRole("button", { name: "Solo de Voz", exact: true }).click();
  await page.getByRole("slider", { name: "Volumen de Piano" }).fill("0.41");
  await page.getByRole("button", { name: "Canción anterior", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/cancion-1$`));
  await expect(play(page)).toHaveAttribute("data-ready", "true", { timeout: 15000 });
  await autoplay(page).click();
  await play(page).click();
  await expect.poll(() => page.getByTestId("time-display").textContent()).not.toBe("0:00");
  // Model Safari requiring a new gesture for contexts created after this Play.
  // Existing, unlocked contexts keep running; the audio engine itself stays real.
  await page.evaluate(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        void this.suspend();
      }
    };
  });
  await expect(page).toHaveURL(new RegExp(`/${slug}/cancion-2$`), { timeout: 15000 });
  await expect(play(page)).toHaveAttribute("data-ready", "true", { timeout: 15000 });
  await expect(autoplay(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Solo de Voz", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("slider", { name: "Volumen de Piano" })).toHaveValue("0.41");
  await expect.poll(() => page.getByTestId("time-display").textContent()).not.toBe("0:00");
  await expect(play(page).locator("svg")).toHaveClass(/tabler-icon-player-play-filled/, {
    timeout: 10000
  });
  await expect(page).toHaveURL(new RegExp(`/${slug}/cancion-2$`));
});

for (const mode of ["off", "disabled", "editing"] as const) {
  test(`finishing does not advance when autoplay is ${mode}`, async ({ page }) => {
    test.setTimeout(20000);
    await page.goto(`/${slug}/cancion-1${mode === "editing" ? "?editar=cancion" : ""}`);
    await expect(play(page)).toHaveAttribute("data-ready", "true");
    if (mode !== "off") await autoplay(page).click();
    if (mode === "disabled") await autoplay(page).click();
    await play(page).click();
    await expect.poll(() => page.getByTestId("time-display").textContent()).not.toBe("0:00");
    await expect(play(page).locator("svg")).toHaveClass(/tabler-icon-player-play-filled/, {
      timeout: 10000
    });
    await expect(page).toHaveURL(new RegExp(`/${slug}/cancion-1`));
  });
}

test("narrow player supports autoplay, manual navigation, reload and resetting the mix", async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/${slug}/cancion-1`);
  await expect(play(page)).toHaveAttribute("data-ready", "true");
  await autoplay(page).click();
  await page.getByRole("button", { name: "Canción siguiente", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/cancion-2$`));
  await expect(play(page)).toHaveAttribute("data-ready", "true");
  await expect(play(page).locator("svg")).toHaveClass(/tabler-icon-player-play-filled/);
  await page.reload();
  await expect(play(page)).toHaveAttribute("data-ready", "true");
  await expect(autoplay(page)).toHaveAttribute("aria-pressed", "false");
  await expect(play(page).locator("svg")).toHaveClass(/tabler-icon-player-play-filled/);
  await page.getByRole("button", { name: "Abrir las pistas", exact: true }).last().click();
  await page.getByRole("button", { name: "Solo de Voz", exact: true }).click();
  await page.getByRole("button", { name: "Restablecer mezcla", exact: true }).click();
  await expect(page.getByRole("button", { name: "Solo de Voz", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
});
