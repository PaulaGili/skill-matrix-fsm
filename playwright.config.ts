import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// The build takes the candidate id from .env.local. The mocked FSM data has to use the same one.
if (!process.env.NEXT_PUBLIC_CANDIDATE_ID && existsSync(".env.local")) process.loadEnvFile(".env.local");

// Runs against the production build (`npm run build` first). FSM is mocked in the browser,
// so the tests need no credentials and never touch the shared company. The browser language
// is fixed, so the app starts in English on every machine.
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: Boolean(process.env.CI), // a forgotten test.only must not turn CI green
  use: { baseURL: "http://localhost:3100", locale: "en-US" },
  webServer: { command: "npm run start -- -p 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI },
});
