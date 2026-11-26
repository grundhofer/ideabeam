// Playwright: Chromium only, against the built app (dist/) served by `vite preview`. Build first: pnpm build.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  timeout: 60_000,
  // a failed test leaves its trace in test-results/ (npx playwright show-trace <zip>)
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm preview",
    url: "http://127.0.0.1:4173",
    // with CI=1 a busy port fails the run instead of testing whatever answers there
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
