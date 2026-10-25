// Extracts Foodpanda menus for stalls in the clean-slate list.
// Run from the repo root on your Mac:
//   node scripts/extract_foodpanda_menus.mjs
// Needs Playwright installed (npx playwright install chromium).
// Reads and writes data/clean-slate/ inside the repo.
// Output: data/clean-slate/menu-items-foodpanda.jsonl
// Every row is marked source "foodpanda", verified false. Re-running skips stalls already done.
//
// Env: CLEAN_DIR, CONCURRENCY (default 4), STALL_LIMIT (default unlimited),
//      FOODPANDA_STALL_LIST (text/CSV of foodpanda URLs; replaces stalls-clean-slate.csv).
// Offline: node scripts/extract_foodpanda_menus.mjs --from-snapshot <saved.html>
//   parses a saved stall page, prints JSONL to stdout, makes no requests, writes nothing.
//
// Data source: the page embeds an Apollo state (menu categories, products, variation prices,
// image URLs). That is read first; the product-tile DOM (data-testid="menu-product*") is the fallback.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CLEAN_DIR = process.env.CLEAN_DIR || new URL('../data/clean-slate', import.meta.url).pathname;
const STALLS = path.join(CLEAN_DIR, 'stalls-clean-slate.csv');
const OUT = path.join(CLEAN_DIR, 'menu-items-foodpanda.jsonl');
const DONE = path.join(CLEAN_DIR, 'foodpanda-done.txt');
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const STALL_LIMIT = Number(process.env.STALL_LIMIT) || Infinity;
const STALL_LIST = process.env.FOODPANDA_STALL_LIST || '';

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
// Foodpanda prices are in dollars (7.5 means S$7.50), not cents.
function parsePrice(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const m = String(v).match(/\d[\d,]*(?:\.\d{1,2})?/);
  const n = m ? Number(m[0].replace(/,/g, '')) : null;
  return n && n > 0 ? n : null;
}

// Foodpanda images come from an on-the-fly resizer (?width=128&height=128). Dropping the query
// returns the original upload (1440px wide in the pilot); asking for more only upscales it.
function hdImage(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  return url.replace(/&amp;/g, '&').replace(/\?.*$/, '');
}

function decodeEntities(t) {
  return t
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Read the JS object literal that follows `marker` (string-aware brace matching).
// The page writes `undefined` as a value, which JSON cannot hold, so it becomes null.
function readObjectAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('{', at + marker.length - 1);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1).replace(/([:[,])undefined/g, '$1null'));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Preferred source: Apollo state with RestaurantMenuCategory -> RestaurantProductData -> variations.
function itemsFromApollo(html) {
  const state = readObjectAfter(html, 'apollo:{')?.initialState;
  if (!state) return [];
  const items = [];
  // Which scheduled menu (e.g. "Brunch (Weekends)", 10:00-15:59) each category belongs to. The page
  // only embeds the menu active at save time, so other menus' items are absent from a snapshot.
  const menuOf = new Map();
  for (const [key, menu] of Object.entries(state)) {
    if (!key.startsWith('RestaurantMenu:')) continue;
    const hours = menu.startTime && menu.endTime ? `${menu.startTime.slice(0, 5)}-${menu.endTime.slice(0, 5)}` : null;
    for (const ref of menu.categories || []) menuOf.set(ref.__ref, { title: menu.title || null, hours });
  }
  for (const [key, cat] of Object.entries(state)) {
    if (!key.startsWith('RestaurantMenuCategory:')) continue;
    const menu = menuOf.get(key);
    for (const ref of cat.products || []) {
      const p = state[ref.__ref];
      if (!p?.title) continue;
      const prices = (p.variations || [])
        .map((v) => parsePrice(state[v.__ref]?.price))
        .filter((n) => n != null);
      const attrs = p.priceAttributes || {};
      const original = parsePrice(attrs.originalPrice) ?? (prices.length ? Math.min(...prices) : null);
      const discounted = parsePrice(attrs.discountedPrice);
      items.push({
        category: cat.title || '',
        menu_title: menu?.title ?? null,
        menu_hours: menu?.hours ?? null,
        item_name: p.title.trim(),
        price_sgd: original,
        discounted_price_sgd: discounted != null && discounted < original ? discounted : null,
        price_from: Boolean(attrs.displayFromTag) || new Set(prices).size > 1,
        variation_prices_sgd: [...new Set(prices)].sort((a, b) => a - b),
        description: (p.description || '').trim(),
        image_url: hdImage(p.image?.url),
        sold_out: Boolean(p.isSoldOut),
      });
    }
  }
  return items;
}

// Fallback: product tiles in the rendered DOM, tagged with data-testid. Prices there read "from S$ 7.50".
function itemsFromDom(html) {
  const field = (tile, id) => {
    const m = tile.match(new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`));
    return m ? decodeEntities(m[1]).trim() : '';
  };
  const items = [];
  const tiles = html.split('data-testid="menu-product"').slice(1);
  for (const tile of tiles) {
    const name = field(tile, 'menu-product-name');
    if (!name) continue;
    const img = tile.match(/data-testid="menu-product-image"[^>]*\ssrc="([^"]+)"/);
    items.push({
      category: '',
      menu_title: null,
      menu_hours: null,
      item_name: name,
      price_sgd: parsePrice(field(tile, 'menu-product-price')),
      discounted_price_sgd: null,
      price_from: /from/i.test(field(tile, 'menu-product-price')),
      variation_prices_sgd: [],
      description: field(tile, 'menu-product-description'),
      image_url: hdImage(img?.[1]),
      sold_out: false,
    });
  }
  return items;
}

export function extractMenuFromHtml(html) {
  const fromState = itemsFromApollo(html);
  return fromState.length ? fromState : itemsFromDom(html);
}

export function vendorFromHtml(html) {
  const url = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
  const name = html.match(/"@type":"Restaurant"[^]*?"name":"([^"]+)"/)?.[1] || '';
  return { url, name, code: url.match(/\/restaurant\/([a-z0-9]+)\//)?.[1] || '' };
}

// Stall list file: CSV with a foodpanda URL column (optionally name / licence columns) or one URL per line.
export function parseStallList(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = splitRow(lines[0]).map((h) => h.trim().toLowerCase());
  const hasHeader = !/^https?:\/\//.test(lines[0]) && header.length > 1;
  const col = (re) => header.findIndex((h) => re.test(h));
  const [nameCol, licCol] = [col(/name/), col(/licen[cs]e/)];
  const stalls = [];
  const seen = new Set();
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitRow(line).map((c) => c.trim());
    const url = cells.find((c) => /^https?:\/\/[^/]*foodpanda\./.test(c));
    if (!url) continue;
    const code = url.match(/\/restaurant\/([a-z0-9]+)\//)?.[1] || url;
    const licence_no = (hasHeader && licCol >= 0 && cells[licCol]) || code;
    if (seen.has(licence_no)) continue;
    seen.add(licence_no);
    stalls.push({ licence_no, name: (hasHeader && nameCol >= 0 && cells[nameCol]) || code, menu_source_url: url });
  }
  return stalls;
}

async function extractStall(page, stall) {
  await page.goto(stall.menu_source_url, { waitUntil: 'networkidle', timeout: 30000 });
  return extractMenuFromHtml(await page.content());
}

async function main() {
  const fromSnapshot = process.argv.indexOf('--from-snapshot');
  if (fromSnapshot > 0) {
    const html = fs.readFileSync(process.argv[fromSnapshot + 1], 'utf8');
    const v = vendorFromHtml(html);
    const items = extractMenuFromHtml(html);
    for (const it of items) {
      console.log(JSON.stringify({
        stall_licence_no: v.code, stall_name: v.name, source_url: v.url,
        source: 'foodpanda', verified: false, ...it,
      }));
    }
    console.error(`snapshot ${v.code}: ${items.length} items`);
    return;
  }

  const stalls = STALL_LIST
    ? parseStallList(fs.readFileSync(STALL_LIST, 'utf8'))
    : parseCsv(fs.readFileSync(STALLS, 'utf8')).filter(
        (s) => s.has_menu_link === 'TRUE' && s.menu_source_url.includes('foodpanda'),
      );
  const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);
  const todo = stalls.filter((s) => !done.has(s.licence_no)).slice(0, STALL_LIMIT);
  console.log(`Foodpanda stalls: ${stalls.length}, to do: ${todo.length}`);

  const { chromium } = await import('playwright');
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
