import { defineConfig } from '@playwright/test';
import base from '../../../playwright.config';
import path from 'node:path';
export default defineConfig({
  ...base,
  testDir: path.resolve(__dirname, '../../../tests/e2e'),
  outputDir: path.resolve(__dirname, 'playwright-chrome-results'),
  reporter: [['line']],
  webServer: base.webServer && !Array.isArray(base.webServer)
    ? { ...base.webServer, cwd: path.resolve(__dirname, '../../..') }
    : base.webServer,
  projects: [{ name: 'chromium', use: { ...base.projects?.[0]?.use, channel: 'chrome', video: 'off' } }],
});
