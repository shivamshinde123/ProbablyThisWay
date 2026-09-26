import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3001";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "5173";
const apiOrigin = "http://localhost:" + apiPort;
const webOrigin = "http://localhost:" + webPort;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { outputFolder: "output/playwright/report", open: "never" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: "output/playwright/report", open: "never" }],
      ],
  outputDir: "output/playwright/artifacts",
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node apps/api/dist/server.js",
      url: apiOrigin + "/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: apiPort,
        WEB_ORIGIN: webOrigin,
      },
    },
    {
      command:
        "node node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port " +
        webPort,
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
