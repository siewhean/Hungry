const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const url = 'https://maps.google.com/?cid=15582527738602849851';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);
  
  await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('div, button, span'));
    for (const el of elements) {
      if (el.innerText && /^(Open|Closed) ·/i.test(el.innerText.trim()) && el.children.length <= 3) {
        el.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);

  const fullTable = await page.evaluate(() => {
    const allTables = Array.from(document.querySelectorAll('table'));
    const res = [];
    for (const t of allTables) {
      res.push(Array.from(t.querySelectorAll('tr')).map(r => r.innerText.replace(/[\n\t]+/g, ' ').trim()));
    }
    return res;
  });
  console.log('Desktop Full Table result:', JSON.stringify(fullTable, null, 2));
  await browser.close();
})();
