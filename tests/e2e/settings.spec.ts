import { type Browser, expect, type Page, test } from "@playwright/test";

// Collection settings → Miembros, against local Supabase: an admin creates a managed
// account, the new person signs in with the one-time password, the admin resets it and
// the person signs in again with the new one.

async function signIn(browser: Browser, username: string, password: string) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("Usuario").fill(username);
  await page.getByPlaceholder("Contraseña").fill(password);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
  await context.close();
}

async function readPasswordAndClose(page: Page) {
  const dialog = page.getByTestId("password-dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });
  const password = (await page.getByTestId("one-time-password").textContent())?.trim() ?? "";
  expect(password).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
  await dialog.getByRole("button", { name: "Listo" }).click();
  return password;
}

test("create a managed account, sign in with it, reset it and sign in again", async ({
  page,
  browser
}) => {
  const username = `e2e.${Date.now().toString(36)}`;

  await page.goto("/test-collection/ajustes/miembros");
  await page.getByTestId("add-member").click();
  await page.getByTestId("managed-username").fill(username);
  await page.getByTestId("add-member-submit").click();
  const first = await readPasswordAndClose(page);

  await expect(page.getByTestId(`member-${username}`)).toBeVisible();
  await signIn(browser, username, first);

  const row = page.getByTestId(`member-${username}`);
  await row.getByRole("button", { name: "Más acciones" }).click();
  await row.getByRole("button", { name: "Generar contraseña nueva" }).click();
  const second = await readPasswordAndClose(page);
  expect(second).not.toBe(first);

  await signIn(browser, username, second);
});

test("settings are only for the collection's admins", async ({ page }) => {
  // A collection the user can't read looks the same as one they don't administer.
  await page.goto("/coleccion-que-no-existe/ajustes");
  await expect(page.getByText("No podés ver estos ajustes")).toBeVisible();
});
