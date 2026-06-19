const { chromium } = require('@playwright/test');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('http://127.0.0.1:3000/console/merchant-applications', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    if (!row) return { error: 'No row found' };

    const approve = row.querySelector('button:nth-child(1)');
    const reqInfo = row.querySelector('button:nth-child(2)');
    const reject = row.querySelector('button:nth-child(3)');
    const cell = approve ? approve.parentElement : null;

    const getElDetails = (el, name) => {
      if (!el) return { name, error: 'not found' };
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      return {
        name,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        overflow: styles.overflow,
        flexShrink: styles.flexShrink
      };
    };

    return {
      cell: getElDetails(cell, 'cell'),
      approve: getElDetails(approve, 'approve'),
      reqInfo: getElDetails(reqInfo, 'reqInfo'),
      reject: getElDetails(reject, 'reject')
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
