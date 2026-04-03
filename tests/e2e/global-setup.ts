import { chromium } from "@playwright/test";
import { execSync } from "child_process";
import { join } from "path";

const AUTH_FILE = join(import.meta.dirname, ".auth", "user.json");

async function globalSetup() {
  // Run seed script
  console.log("Running seed script...");
  execSync("npx tsx tests/e2e/seed.ts", {
    stdio: "inherit",
    cwd: join(import.meta.dirname, "..", "..")
  });

  // Authenticate and save state
  console.log("Authenticating test user...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("http://localhost:5173/login");
  await page.getByPlaceholder("Usuario").fill("test");
  await page.getByPlaceholder("Contraseña").fill("testpass123");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  // Wait for redirect after login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000
  });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
  console.log("Auth state saved");
}

export default globalSetup;
