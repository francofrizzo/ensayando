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

test("the inspector sets a verse's color", async ({ page }) => {
  await page.goto(`${SONG}?editar=letra`);
  const verses = page.locator("[data-lyrics-input]");
  await expect(verses.first()).toBeVisible({ timeout: 15000 });

  await verses.first().click();
  const vocals = page.getByTestId("inspector-color-vocals");
  await expect(vocals).toHaveAttribute("aria-pressed", "false");
  await vocals.click();
  await expect(vocals).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("save-changes")).toBeEnabled();

  // One undo step brings it back
  await verses.first().click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(vocals).toHaveAttribute("aria-pressed", "false");
});

test("⇧+clic selects several verses and the inspector applies to all", async ({ page }) => {
  await page.goto(`${SONG}?editar=letra`);
  const verses = page.locator("[data-lyrics-input]");
  await expect(verses.first()).toBeVisible({ timeout: 15000 });

  await verses.nth(0).click();
  await verses.nth(2).click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("inspector-count")).toBeVisible();
  await expect(page.getByTestId("lyrics-inspector")).toContainText("3 versos seleccionados");

  const guitar = page.getByTestId("inspector-color-guitar");
  await guitar.click();
  await expect(guitar).toHaveAttribute("aria-pressed", "true");

  // Each of the three has it now; the fourth doesn't
  for (const index of [0, 1, 2]) {
    await verses.nth(index).click();
    await expect(guitar).toHaveAttribute("aria-pressed", "true");
  }
  await verses.nth(3).click();
  await expect(guitar).toHaveAttribute("aria-pressed", "false");

  // Leave the seed data as it was
  await page.getByTestId("exit-edit").click();
  await page.getByTestId("unsaved-discard").click();
  await expect(page).not.toHaveURL(/editar=/);
});

test("a line of a column can be dragged out of its row", async ({ page }) => {
  await page.goto(`${SONG}?editar=letra`);
  await expect(page.locator("[data-lyrics-input]").first()).toBeVisible({ timeout: 15000 });

  // "uno / dos" is a row of two columns; "tres" a regular verse
  await page.getByRole("button", { name: "Más opciones" }).click();
  await page.getByTestId("paste-lyrics").click();
  await page.getByLabel("Reemplazar la letra actual").check();
  await page.getByTestId("paste-lyrics-text").fill("uno / dos\ntres");
  await page.getByTestId("paste-lyrics-apply").click();

  const inputs = page.locator("[data-lyrics-input]");
  await expect(inputs).toHaveCount(3);
  // Rows in order: "uno" and "dos" (the row of columns), then "tres"
  const rows = page.locator("[data-lyric-hitbox]");
  await expect(inputs.nth(1)).toHaveValue("dos");

  // Drag "dos" (the second column) below "tres"
  const target = rows.nth(2);
  const box = (await target.boundingBox())!;
  await rows
    .nth(1)
    .locator("[draggable='true']")
    .dragTo(target, { targetPosition: { x: box.width / 2, y: box.height - 2 } });

  await expect(inputs).toHaveCount(3);
  expect(
    await inputs.evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
  ).toEqual(["uno", "tres", "dos"]);
  // The row it left had one line left, so it became a regular verse
  await expect(page.getByTestId("columns-drag-handle")).toHaveCount(0);
});
