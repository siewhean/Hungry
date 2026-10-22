import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import path from "node:path";
export default defineConfig({
  ...base,
  testDir: path.resolve(__dirname, "../../../tests/e2e"),
  testMatch: "buttons-interactions.spec.ts",
  outputDir: path.join(__dirname, "legacy-composer-results"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(__dirname, "legacy-composer-results.json") }],
  ],
});
