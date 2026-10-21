import { expect, test, type Page } from "@playwright/test";

test.setTimeout(30000);

const duration = 60;
const channels = (voice: number) =>
  Array.from({ length: 2 }, (_, channel) =>
    Array.from({ length: duration }, (_, second) => {
      if (voice === 2) return 30; // Instrumental never vetoes a vocal pause.
      if (voice === 1) return channel === 1 && second >= 2 && second < 40 ? 0.3 : 0;
      return second < 2 || (second >= 40 && second < 45) ? 30 : 0;
    })
  );

function recording(voice: number) {
  const peaks = channels(voice);
  const rate = 8000;
  const wav = Buffer.alloc(44 + duration * rate * 4);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < duration * rate; i++) {
    for (let channel = 0; channel < 2; channel++) {
      const active = peaks[channel]![Math.floor(i / rate)] !== 0;
      wav.writeInt16LE(
        active ? Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)) : 0,
        44 + i * 4 + channel * 2
      );
    }
  }
  return wav;
}

async function openSong(page: Page, missingPeaks = false) {
  await page.addInitScript(() => localStorage.setItem("ens-ios-audio-notice-v1", "1"));
  // Keep the real local collection/auth/player, supplying controlled recordings
  // and peaks without mutating the shared seed used by other suites.
  await page.route("**/rest/v1/songs*", async (route) => {
    const response = await route.fetch();
    const songs = await response.json();
    for (const song of songs) {
      if (song.slug !== "test-song") continue;
      const source = song.audio_tracks[0];
      song.audio_tracks = ["Voz A", "Voz B", "Instrumental"].map((title, index) => ({
        ...source,
        id: 900001 + index,
        title,
        order: index,
        kind: index === 2 ? "instrumental" : "voice",
        audio_file_key: null,
        playback_url: undefined,
        audio_file_url: `http://localhost:5173/silence-${index}.wav`,
        peaks: missingPeaks && index === 1 ? null : { duration, channels: channels(index) }
      }));
    }
    await route.fulfill({ response, json: songs });
  });
  await page.route("**/silence-*.wav", (route) => {
    const voice = Number(
      route
        .request()
        .url()
        .match(/silence-(\d)/)![1]
    );
    return route.fulfill({ body: recording(voice), contentType: "audio/wav" });
  });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/test-collection/test-song");
  await expect(page.getByRole("button", { name: "Play/Pause" })).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 15000 }
  );
  await page.getByRole("button", { name: "Abrir las pistas", exact: true }).first().click();
}

const solo = (page: Page, name: string) =>
  page.getByRole("button", { name: `Solo de ${name}`, exact: true });
const toggle = (page: Page) => page.getByRole("checkbox", { name: "Saltar silencios" });
async function menu(page: Page) {
  await page.getByRole("button", { name: "Menú de la canción", exact: true }).click();
}
async function seek(page: Page, seconds: number) {
  const position = page.getByRole("slider", { name: "Posición", exact: true });
  const box = (await position.boundingBox())!;
  await position.click({ position: { x: (box.width * seconds) / duration, y: box.height / 2 } });
}
const clock = async (page: Page) => {
  const text = await page.getByTestId("time-display").innerText();
  const [minutes, seconds] = text.split(":").map(Number);
  return minutes! * 60 + seconds!;
};

test("skips only simultaneous vocal pauses, preserves manual seeks and suspends in the editor", async ({
  page
}) => {
  await openSong(page);
  await solo(page, "Voz A").click();
  await menu(page);
  await toggle(page).check();
  await page.getByTestId("song-title").click();
  await expect(page.getByTestId("silence-region").first()).toBeAttached();
  await seek(page, 6.5); // Before the padded gap; normal playback must cross into it.
  await page.getByRole("button", { name: "Play/Pause" }).click();
  await expect.poll(() => clock(page)).toBeGreaterThanOrEqual(34);
  await seek(page, 15); // A deliberate seek into the pause must not be overridden.
  await expect.poll(() => clock(page)).toBeLessThan(20);
  await solo(page, "Voz B").click(); // Its right channel fills the entire pause.
  await expect(page.getByTestId("silence-region")).toHaveCount(0);
  await page.getByRole("slider", { name: "Volumen de Voz B", exact: true }).fill("0");
  await expect(page.getByTestId("silence-region").first()).toBeAttached();
  await page.getByRole("slider", { name: "Volumen de Voz B", exact: true }).fill("1");
  await expect(page.getByTestId("silence-region")).toHaveCount(0);
  await solo(page, "Voz B").click();
  await seek(page, 6.5);
  await expect.poll(() => clock(page)).toBeGreaterThanOrEqual(34);
  await page.keyboard.press("e");
  await expect(page.getByTestId("silence-region")).toHaveCount(0);
});

test("missing selected peaks disable skipping, but missing unselected peaks do not", async ({
  page
}) => {
  await openSong(page, true);
  await menu(page);
  await expect(toggle(page)).toBeDisabled();
  await page.getByTestId("song-title").click();
  await solo(page, "Voz A").click();
  await menu(page);
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).check();
  await page.getByTestId("song-title").click();
  await expect(page.getByTestId("silence-region").first()).toBeAttached();
  await solo(page, "Voz B").click();
  await expect(page.getByTestId("silence-region")).toHaveCount(0);
});
