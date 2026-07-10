import { defineConfig, devices } from "@playwright/test";

const requestedPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 8082;
const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8082;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*mobile-(ios|android)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile-ios",
      testMatch: /.*mobile-ios\.spec\.ts/,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
    {
      name: "mobile-android",
      testMatch: /.*mobile-android\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: `node ./scripts/run-expo.cjs start --localhost --port=${port} --clear`,
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          CI: "1",
          HUNGRY_EXPO_E2E_WEBSERVER: "1",
          HUNGRY_DATA_SOURCE: "mock",
          EXPO_PUBLIC_HUNGRY_DATA_SOURCE: "mock",
          EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE: "mock",
          EXPO_PUBLIC_MOCK_MAPBOX_ENABLED: "1",
          EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
          EXPO_PUBLIC_DISABLE_POSTHOG: "1",
          EXPO_NO_DOTENV: "1",
          EXPO_NO_TELEMETRY: "1",
        },
      }
    : undefined,
});
