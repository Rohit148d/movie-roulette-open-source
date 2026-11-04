import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const HOST = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const USE_EXTERNAL_SERVER = process.env.PLAYWRIGHT_EXTERNAL === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_DEPLOYED_URL ?? `http://${HOST}:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: USE_EXTERNAL_SERVER
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `http://${HOST}:${PORT}/api/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          TMDB_DEMO_MODE: "true",
          TMDB_READ_ACCESS_TOKEN: "",
          TMDB_API_KEY: "",
        },
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
