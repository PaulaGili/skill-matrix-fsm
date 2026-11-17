import { defineConfig } from "@playwright/test";

// Runs against the production build (`npm run build` first). FSM is mocked in the browser,
// so the tests need no credentials and never touch the shared company.
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: { command: "npm run start -- -p 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI },
});
