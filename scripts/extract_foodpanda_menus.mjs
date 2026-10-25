// Extracts Foodpanda menus for stalls in the clean-slate list.
// Run on your Mac from the repo root:
//   node scripts/extract_foodpanda_menus.mjs
// Needs Playwright installed (npx playwright install chromium).
// Output: /mnt/project-files/verification/clean-slate/menu-items-foodpanda.jsonl
// Every row is marked source "foodpanda", verified false. Re-running skips stalls already done.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CLEAN_DIR = process.env.CLEAN_DIR || '/mnt/project-files/verification/clean-slate';
const STALLS = path.join(CLEAN_DIR, 'stalls-clean-slate.csv');
const OUT = path.join(CLEAN_DIR, 'menu-items-foodpanda.jsonl');
const DONE = path.join(CLEAN_DIR, 'foodpanda-done.txt');
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = splitRow(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(splitRow(l).map((v, i) => [head[i], v])));
}

function splitRow(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Keep the first SGD amount. Ranges and missing prices return null, never 0.
function parsePrice(v) {
  if (v == null) return null;
  const m = String(v).match(/\d[\d,]*(?:\.\d{1,2})?/);
  return m ? Number(m[0].replace(/,/g, '')) : null;
}

// Pick the largest image candidate from a srcset, so the image is not a thumbnail.
function bestImage(src, srcset) {
  if (srcset) {
    const parts = srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return src && src.startsWith('http') ? src : null;
}

async function extractStall(page, stall) {
  await page.goto(stall.menu_source_url, { waitUntil: 'networkidle', timeout: 30000 });
  // Foodpanda shows the menu items in the page HTML too, so read them from the DOM as a fallback.
  const domItems = await page.$$eval('[data-testid*="product"], [class*="product"]', (els) =>
    els.map((el) => ({
      name: el.querySelector('h3, [class*="name"]')?.textContent?.trim() || '',
      price: el.querySelector('[class*="price"]')?.textContent?.trim() || '',
      description: el.querySelector('[class*="description"]')?.textContent?.trim() || '',
      src: el.querySelector('img')?.getAttribute('src') || '',
      srcset: el.querySelector('img')?.getAttribute('srcset') || '',
    })),
  );
  return domItems
    .filter((i) => i.name)
    .map((i) => ({
      category: '',
      item_name: i.name,
      price_sgd: parsePrice(i.price),
      description: i.description,
      image_url: bestImage(i.src, i.srcset),
    }));
}

async function main() {
  const stalls = parseCsv(fs.readFileSync(STALLS, 'utf8')).filter(
    (s) => s.has_menu_link === 'TRUE' && s.menu_source_url.includes('foodpanda'),
  );
  const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);
  const todo = stalls.filter((s) => !done.has(s.licence_no));
  console.log(`Foodpanda stalls: ${stalls.length}, to do: ${todo.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let next = 0;

  async function worker() {
    while (next < todo.length) {
      const stall = todo[next++];
      const page = await context.newPage();
      try {
        const items = await extractStall(page, stall);
        for (const it of items) {
          fs.appendFileSync(OUT, JSON.stringify({
            stall_licence_no: stall.licence_no,
            stall_name: stall.name,
            source_url: stall.menu_source_url,
            source: 'foodpanda',
            verified: false,
            ...it,
          }) + '\n');
        }
        fs.appendFileSync(DONE, stall.licence_no + '\n');
        console.log(`ok ${stall.licence_no} ${items.length} items`);
      } catch (e) {
        console.log(`fail ${stall.licence_no}: ${e.message}`);
      } finally {
        await page.close();
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
