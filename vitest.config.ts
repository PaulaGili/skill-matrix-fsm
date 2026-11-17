import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // A fixed namespace, so the tests do not depend on .env.local.
    env: { NEXT_PUBLIC_CANDIDATE_ID: "tester" },
  },
});
