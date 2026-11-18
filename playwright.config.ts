import { defineConfig } from "@playwright/test";

// Runs against the production build (`npm run build` first). FSM is mocked in the browser,
// so the tests need no credentials and never touch the shared company. The browser language
// is fixed, so the app starts in English on every machine.
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100", locale: "en-US" },
  webServer: { command: "npm run start -- -p 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI },
});
