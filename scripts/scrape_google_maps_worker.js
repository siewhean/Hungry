const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGETS_FILE = path.join(__dirname, '../data/google_maps_scrape_targets.json');
const CHECKPOINT_FILE = path.join(__dirname, '../data/google_maps_scraped_hours.json');

function cleanSchedule(rows) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayMap = {};

  for (const raw of rows) {
    const cleaned = raw.replace(/[\ue000-\uf8ff]/g, '').replace(/[\n\t]+/g, ' ').trim();
    for (const d of dayOrder) {
      if (cleaned.startsWith(d)) {
        let timePart = cleaned.slice(d.length).trim();
        timePart = timePart.replace(/–|-|—/g, ' – ');
        timePart = timePart.replace(/\s+/g, ' ').trim();
        timePart = timePart.replace(/(\d+)(am|pm)/gi, '$1 $2').replace(/ /g, ' ');
        dayMap[d] = timePart;
        break;
      }
    }
  }

  if (Object.keys(dayMap).length === 0) return null;

  const parts = [];
  for (const d of dayOrder) {
    if (dayMap[d]) {
      parts.push(`${d}: ${dayMap[d]}`);
    }
  }
  return parts.join('; ');
}

async function scrapeSingle(page, target) {
  const url = target.url;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    const isClosed = await page.evaluate(() => {
      const text = document.body.innerText;
      if (/Permanently closed/i.test(text)) return 'Permanently closed';
      if (/Temporarily closed/i.test(text)) return 'Temporarily closed';
      return null;
    });

    if (isClosed) {
      return { status: isClosed, schedule: isClosed };
    }

    // Try to click hours expander
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

async function runWorker(batchLimit = 100, concurrency = 2) {
  if (!fs.existsSync(TARGETS_FILE)) {
    console.error('Targets file not found:', TARGETS_FILE);
    return;
  }

  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
  let checkpoint = {};
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  }

  const pending = targets.filter(t => !checkpoint[t.licence]);
  console.log(`Total targets: ${targets.length}`);
  console.log(`Already checkpointed: ${Object.keys(checkpoint).length}`);
  console.log(`Pending: ${pending.length}`);

  const toProcess = pending.slice(0, batchLimit);
  console.log(`Processing batch of: ${toProcess.length} with concurrency: ${concurrency}`);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  let index = 0;
  let successCount = 0;

  async function worker(workerId) {
    const page = await context.newPage();
    while (index < toProcess.length) {
      const currentIndex = index++;
      const item = toProcess[currentIndex];
      const res = await scrapeSingle(page, item);

      checkpoint[item.licence] = {
        name: item.name,
        address: item.address,
        url: item.url,
        status: res.status,
        schedule: res.schedule,
        updatedAt: new Date().toISOString()
      };

      if (res.schedule && res.status === 'OK') {
        successCount++;
      }

      console.log(`[W${workerId}] [${currentIndex + 1}/${toProcess.length}] ${item.name} (${item.licence}) => ${res.status}: ${res.schedule ? res.schedule.slice(0, 50) + '...' : 'None'}`);

      // Save checkpoint every 5 records
      if (currentIndex % 5 === 0 || currentIndex === toProcess.length - 1) {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf8');
      }
    }
    await page.close();
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(i + 1));
  }

  await Promise.all(workers);
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf8');
  await browser.close();

  console.log(`Batch complete! New authentic hours extracted: ${successCount}`);
}

const args = process.argv.slice(2);
const limit = args[0] ? parseInt(args[0], 10) : 50;
const conc = args[1] ? parseInt(args[1], 10) : 2;

runWorker(limit, conc).catch(err => {
  console.error('Worker failed:', err);
  process.exit(1);
});
