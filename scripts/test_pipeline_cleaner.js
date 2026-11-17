const { chromium } = require('playwright');
const fs = require('fs');

function cleanSchedule(rows) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayMap = {};

  for (const raw of rows) {
    // remove special unicode characters like  (\ue14d)
    const cleaned = raw.replace(/[\ue000-\uf8ff]/g, '').replace(/[\n\t]+/g, ' ').trim();
    for (const d of dayOrder) {
      if (cleaned.startsWith(d)) {
        let timePart = cleaned.slice(d.length).trim();
        // standardize dashes and spaces
        timePart = timePart.replace(/–|-|—/g, ' – ');
        timePart = timePart.replace(/\s+/g, ' ').trim();
        // normalize AM/PM
        timePart = timePart.replace(/(\d+)(am|pm)/gi, '$1 $2').replace(/ /g, ' ');
        dayMap[d] = timePart;
        break;
      }
    }
  }

  if (Object.keys(dayMap).length === 0) return null;

  // Format ordered
  const parts = [];
  for (const d of dayOrder) {
    if (dayMap[d]) {
      parts.push(`${d}: ${dayMap[d]}`);
    }
  }
  return parts.join('; ');
}

async function scrapeUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    // Check if permanently closed or temporarily closed
    const isClosed = await page.evaluate(() => {
      const text = document.body.innerText;
      if (/Permanently closed/i.test(text)) return 'Permanently closed';
      if (/Temporarily closed/i.test(text)) return 'Temporarily closed';
      return null;
    });

    if (isClosed) {
      return { status: isClosed, schedule: isClosed };
    }

    // Click trigger for hours
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div, button, span'));
      for (const el of elements) {
        if (el.innerText && /^(Open|Closed) ·/i.test(el.innerText.trim()) && el.children.length <= 3) {
          el.click();
          break;
        }
      }
    });
    await page.waitForTimeout(1200);

    // Extract table rows
    const rows = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return [];
      return Array.from(table.querySelectorAll('tr')).map(r => r.innerText.trim());
    });

    if (rows.length > 0) {
      const formatted = cleanSchedule(rows);
      if (formatted) {
        return { status: 'OK', schedule: formatted };
      }
    }

    // Check 24 hours
    const is24h = await page.evaluate(() => {
      return /Open 24 hours/i.test(document.body.innerText);
    });
    if (is24h) {
      return { status: 'OK', schedule: 'Open 24 hours daily' };
    }

    return { status: 'NO_HOURS', schedule: null };
  } catch (err) {
    return { status: 'ERROR', error: err.message, schedule: null };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const testUrls = [
    'https://maps.google.com/?cid=15582527738602849851', // 2am dessertbar
    'https://maps.google.com/?cid=12884642580545196838', // Five izakaya (permanently closed)
    'https://maps.google.com/?cid=15038246842580988549', // Akbar 24 hours
  ];

  for (const u of testUrls) {
    console.log('Testing:', u);
    const res = await scrapeUrl(page, u);
    console.log('Result:', res);
  }

  await browser.close();
})();
