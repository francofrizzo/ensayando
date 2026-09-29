import { expect, test } from "@playwright/test";

const SONG = "/test-collection/test-song";

test("E opens edit mode and the edit bar replaces the top bar", async ({ page }) => {
  await page.goto(SONG);
  await expect(page.getByTestId("song-title")).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/editar=cancion/);
  await expect(page.getByTestId("edit-bar")).toBeVisible();
  await expect(page.getByTestId("song-title")).toBeHidden();
  // The dock stays so you can listen while editing
  await expect(page.getByTestId("player-dock")).toBeVisible();
});

test("tabs switch in the URL", async ({ page }) => {
  await page.goto(`${SONG}?editar=cancion`);
  await page.getByTestId("edit-tab-letra").click();
  await expect(page).toHaveURL(/editar=letra/);
  await page.getByTestId("edit-tab-sincronizar").click();
  await expect(page).toHaveURL(/editar=sincronizar/);
});

test("leaving with unsaved lyrics asks first, and discarding restores them", async ({ page }) => {
  await page.goto(`${SONG}?editar=letra`);
  const firstVerse = page.locator("[data-lyrics-input]").first();
  await expect(firstVerse).toBeVisible({ timeout: 15000 });
  const original = await firstVerse.inputValue();

  await firstVerse.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" cambio");
  await expect(page.getByTestId("save-changes")).toBeEnabled();

  await page.getByTestId("exit-edit").click();
  await expect(page.getByTestId("unsaved-dialog")).toBeVisible();

  // "Seguir editando" keeps everything
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(page.getByTestId("unsaved-dialog")).toBeHidden();
  await expect(page).toHaveURL(/editar=letra/);

  await page.getByTestId("exit-edit").click();
  await page.getByTestId("unsaved-discard").click();
  await expect(page).not.toHaveURL(/editar=/);
  await expect(page.getByTestId("edit-bar")).toBeHidden();

  await page.goto(`${SONG}?editar=letra`);
  await expect(page.locator("[data-lyrics-input]").first()).toHaveValue(original);
});

test("without changes, exiting doesn't ask", async ({ page }) => {
  await page.goto(`${SONG}?editar=cancion`);
  await expect(page.getByTestId("edit-bar")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("exit-edit").click();
  await expect(page.getByTestId("unsaved-dialog")).toBeHidden();
  await expect(page).not.toHaveURL(/editar=/);
});

test("nueva canción opens the song form in create mode", async ({ page }) => {
  await page.goto("/test-collection/nueva");
  await expect(page.getByTestId("edit-bar")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("save-changes")).toContainText("Crear canción");
});
