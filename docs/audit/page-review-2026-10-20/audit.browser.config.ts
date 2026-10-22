import { defineConfig } from '@playwright/test';
import base from './playwright.chrome.config';
export default defineConfig({
  ...base,
  testDir: __dirname,
  testMatch: 'audit.browser.spec.ts',
  outputDir: `${__dirname}/audit-browser-results`,
  timeout: 60000,
  projects: [{ name: 'chromium', use: { channel: 'chrome', video: 'off', viewport: { width: 390, height: 844 } } }],
});
