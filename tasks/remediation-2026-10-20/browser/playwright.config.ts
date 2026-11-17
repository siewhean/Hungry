import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";
import path from "node:path";
const root = path.resolve(__dirname, "../../..");
export default defineConfig({
  ...base,
  testDir: __dirname,
  testMatch: "remediation.browser.spec.ts",
  workers: 1,
  timeout: 90000,
  reporter: [["line"], ["json", { outputFile: path.join(__dirname, "results.json") }]],
  outputDir: path.join(__dirname, "results"),
  webServer:
    base.webServer && !Array.isArray(base.webServer)
      ? { ...base.webServer, cwd: root }
      : base.webServer,
  projects: [
    {
      name: "chromium",
      use: { channel: "chrome", video: "off", trace: "off", viewport: { width: 390, height: 844 } },
    },
  ],
});
