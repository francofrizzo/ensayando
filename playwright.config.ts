import { defineConfig } from "@playwright/test";
import { join } from "path";

// Local Supabase deterministic anon key
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 15000,
  retries: 1,
  globalSetup: join(import.meta.dirname, "tests/e2e/global-setup.ts"),
  use: {
    baseURL: "http://localhost:5173",
    storageState: "tests/e2e/.auth/user.json",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ],
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY
    }
  }
});
