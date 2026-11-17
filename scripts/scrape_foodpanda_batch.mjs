#!/usr/bin/env node
/**
 * scripts/scrape_foodpanda_batch.mjs
 *
 * Automated batch scraper for Foodpanda URLs using system Chrome with stealth.
 * Fetches stall pages, runs the parser (scripts/foodpanda_menu_parser.py),
 * and saves structured results.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PARSER_SCRIPT = path.join(__dirname, 'foodpanda_menu_parser.py');

// Parse CLI arguments
const args = process.argv.slice(2);
let limit = 5;
let startIndex = 0;
let specificLicence = null;
let inputFile = path.join(ROOT_DIR, 'data', 'foodpanda_supplied_stalls.csv');
let outputFile = path.join(ROOT_DIR, 'data', 'foodpanda_batch_scraped_menus.json');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10);
  else if (args[i] === '--start' && args[i + 1]) startIndex = parseInt(args[++i], 10);
  else if (args[i] === '--licence' && args[i + 1]) specificLicence = args[++i];
  else if (args[i] === '--input' && args[i + 1]) inputFile = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputFile = args[++i];
}

async function main() {
  console.log(`[Foodpanda Scraper] Loading stalls from ${inputFile}...`);
  const lines = fs.readFileSync(inputFile, 'utf-8').trim().split('\n');
  const stalls = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      const name = parts[0].trim();
      const licence = parts[1].trim();
      const url = parts.slice(2).join(',').trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        stalls.push({ name, licence, url });
      }
    }
  }

  console.log(`[Foodpanda Scraper] Found ${stalls.length} valid stalls.`);

  let targetStalls = stalls;
  if (specificLicence) {
    targetStalls = stalls.filter(s => s.licence === specificLicence);
    console.log(`[Foodpanda Scraper] Filtered to licence ${specificLicence}: ${targetStalls.length} found.`);
  } else {
    targetStalls = stalls.slice(startIndex, startIndex + limit);
    console.log(`[Foodpanda Scraper] Processing batch ${startIndex} to ${startIndex + targetStalls.length - 1} (${targetStalls.length} stalls).`);
  }

  console.log('[Foodpanda Scraper] Launching system Google Chrome with stealth...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const page = await browser.newPage();
  const results = [];

  for (let i = 0; i < targetStalls.length; i++) {
    const stall = targetStalls[i];
    console.log(`\n[${i + 1}/${targetStalls.length}] Scraping: ${stall.name} (${stall.licence})`);
    console.log(`  URL: ${stall.url}`);

    try {
      await page.goto(stall.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const html = await page.content();
      const tempHtmlPath = path.join(ROOT_DIR, 'scratch', `temp_fp_${stall.licence}.html`);
      fs.writeFileSync(tempHtmlPath, html, 'utf-8');

      // Call python parser
      const pyOutput = execFileSync('python3', [
        PARSER_SCRIPT,
        '--file', tempHtmlPath,
        '--licence', stall.licence,
        '--name', stall.name
      ], { encoding: 'utf-8' });

      // Clean temp file
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

      // Parse JSON
      const jsonStart = pyOutput.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(pyOutput.slice(jsonStart));
        parsed.source_url = stall.url;
        console.log(`  Result: ${parsed.success ? 'SUCCESS' : 'NO ITEMS'} (${parsed.items?.length || 0} items via ${parsed.method})`);
        results.push(parsed);
      } else {
        console.log('  Result: FAILED to parse python output');
      }

      // Small respectful delay
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`  Error scraping ${stall.name}:`, e.message);
      results.push({
        success: false,
        stall_name: stall.name,
        sfa_licence: stall.licence,
        source_url: stall.url,
        error: e.message,
        items: []
      });
    }
  }

  await browser.close();

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n[Foodpanda Scraper] Done! Wrote ${results.length} stall results to ${outputFile}`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
