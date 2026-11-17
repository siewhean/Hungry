const { chromium } = require('@playwright/test');
const path = require('path');

const targetDir = '/Users/Siew Hean/.gemini/antigravity/brain/da273cfd-4023-4f3d-9026-31e13e590763';

const pages = [
  { name: 'homepage', url: 'http://127.0.0.1:3000/' },
  { name: 'for-foodies', url: 'http://127.0.0.1:3000/for-foodies' },
  { name: 'for-merchants', url: 'http://127.0.0.1:3000/for-merchants' },
  { name: 'console-overview', url: 'http://127.0.0.1:3000/console' },
  { name: 'console-users', url: 'http://127.0.0.1:3000/console/users' },
  { name: 'console-merchants', url: 'http://127.0.0.1:3000/console/merchants' },
  { name: 'console-waitlist', url: 'http://127.0.0.1:3000/console/waitlist' },
  { name: 'console-merchant-applications', url: 'http://127.0.0.1:3000/console/merchant-applications' },
  { name: 'console-feedback', url: 'http://127.0.0.1:3000/console/feedback' },
  { name: 'console-reports', url: 'http://127.0.0.1:3000/console/reports' },
  { name: 'console-notifications', url: 'http://127.0.0.1:3000/console/notifications' },
  { name: 'console-product-analytics', url: 'http://127.0.0.1:3000/console/product-analytics' },
  { name: 'console-feature-flags', url: 'http://127.0.0.1:3000/console/feature-flags' },
  { name: 'console-audit-log', url: 'http://127.0.0.1:3000/console/audit-log' }
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Desktop screen
  await page.setViewportSize({ width: 1440, height: 1080 });

  for (const p of pages) {
    console.log(`Navigating to ${p.url}...`);
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const screenshotPath = path.join(targetDir, `${p.name}.png`);
      console.log(`Taking screenshot of ${p.name} -> ${screenshotPath}`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch (err) {
      console.error(`Error screenshotting ${p.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('Done screenshotting all pages!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
