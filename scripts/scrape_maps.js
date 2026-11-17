const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '..', 'data', 'uris_to_check.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scrape_results.json');

let captchaCount = 0;
let uriToTargets = new Map(); // Maps URI -> Array of target objects

// Configuration
const CONCURRENCY = 35; // Number of concurrent browser pages
const SAVE_INTERVAL = 20; // Save results to disk every 20 completed CIDs
const BROWSER_RESTART_INTERVAL = 400; // Restart browser after this many pages to avoid memory leaks

async function scrapeBatch(targets, resultsMap) {
    console.log(`Starting browser batch for ${targets.length} unique CIDs...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    });

    let activeCount = 0;
    let completedCount = 0;
    let index = 0;

    function saveResults() {
        const mergedResults = Array.from(resultsMap.values());
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedResults, null, 2), 'utf-8');
        console.log(`[Checkpoint] Saved ${mergedResults.length} total results to ${OUTPUT_PATH}`);
    }

    async function worker() {
        while (index < targets.length) {
            const target = targets[index++];
            activeCount++;

            let isClosed = "No";
            let imageUrl = "";
            let isValid = "Yes";

            const page = await context.newPage();
            try {
                // Block heavy assets to speed up loading
                await page.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });

                console.log(`[Active: ${activeCount}] Checking CID for [Row ${target.row_index}]: ${target.uri}`);

                // Short timeout for navigation, as we block assets anyway
                await page.goto(target.uri, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(e => {
                    // Ignore page.goto timeouts, as we will check the DOM anyway
                });

                // Dynamic wait for title, H1 or content loading
                let loaded = false;
                for (let i = 0; i < 10; i++) {
                    const title = await page.title().catch(() => "");
                    const h1Text = await page.$eval('h1', el => el.textContent).catch(() => "");
                    const content = await page.content().catch(() => "");

                    if ((title && title !== "Google Maps") || (h1Text && h1Text.trim() !== "")) {
                        loaded = true;
                        break;
                    }
                    if (content.includes("couldn't be found") || content.includes("Google Maps can't find") || content.includes("we couldn't find") || content.includes("recaptcha") || content.includes("captcha")) {
                        loaded = true;
                        break;
                    }
                    await page.waitForTimeout(200);
                }

                const title = await page.title().catch(() => "Google Maps");
                const h1Text = await page.$eval('h1', el => el.textContent).catch(() => "");
                const content = await page.content().catch(() => "");

                // Validation check
                if (!content || content.length < 10000) {
                    isValid = "Unknown";
                } else if (content.includes("google.com/sorry") || content.includes("recaptcha") || content.includes("captcha")) {
                    console.warn(` -> Rate-limit or CAPTCHA page detected at row ${target.row_index}!`);
                    isValid = "Unknown";
                    captchaCount++;
                    if (captchaCount > 5) {
                        console.error("Too many CAPTCHAs/rate-limits detected. Exiting process to avoid further IP blocking.");
                        process.exit(2);
                    }
                } else {
                    captchaCount = 0; // reset
                    if (title !== "Google Maps" || (h1Text && h1Text.trim() !== "")) {
                        isValid = "Yes";
                    } else if (content.includes("couldn't be found") || content.includes("Google Maps can't find") || content.includes("we couldn't find")) {
                        isValid = "No";
                    } else {
                        isValid = "No";
                    }
                }

                if (isValid === "Yes") {
                    if (content.includes('Permanently closed') || content.includes('Temporarily closed')) {
                        isClosed = "Yes";
                    }

                    // Extract image URL
                    const metaImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => "");
                    if (metaImage && !metaImage.includes('streetview')) {
                        imageUrl = metaImage;
                    } else {
                        const photoImg = await page.$eval('button[aria-label*="Photo"] img', el => el.src).catch(() => "");
                        if (photoImg) {
                            imageUrl = photoImg;
                        }
                    }
                } else if (isValid === "No") {
                    console.log(` -> INVALID location link detected for URI: ${target.uri}`);
                }
            } catch (e) {
                console.error(`Error checking [Row ${target.row_index}]: ${e.message}`);
                isValid = "Unknown";
            } finally {
                await page.close();
            }

            // Propagate the result to all rows sharing the same URI
            const sharedTargets = uriToTargets.get(target.uri) || [target];
            for (const st of sharedTargets) {
                const res = {
                    row_index: st.row_index,
                    isClosed,
                    imageUrl,
                    isValid: isValid === "Unknown" ? undefined : isValid
                };
                resultsMap.set(st.row_index, res);
            }

            activeCount--;
            completedCount++;

            if (completedCount % SAVE_INTERVAL === 0) {
                saveResults();
            }
        }
    }

    const workerPromises = [];
    const numWorkers = Math.min(CONCURRENCY, targets.length);
    for (let i = 0; i < numWorkers; i++) {
        workerPromises.push(worker());
    }

    await Promise.all(workerPromises);
    await browser.close();
    saveResults();

    // Trigger GC if exposed
    if (global.gc) {
        console.log("Triggering explicit Garbage Collection...");
        global.gc();
    }
}

async function main() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error(`Input file not found at ${INPUT_PATH}. Run extract_maps_uris.py first.`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(INPUT_PATH, 'utf-8');
    const allTargets = JSON.parse(rawData);

    // Map URI to all targets sharing it
    for (const t of allTargets) {
        if (!uriToTargets.has(t.uri)) {
            uriToTargets.set(t.uri, []);
        }
        uriToTargets.get(t.uri).push(t);
    }
    console.log(`Loaded ${allTargets.length} total rows mapped to ${uriToTargets.size} unique CIDs.`);

    // Resume capability: Load existing results
    let resultsMap = new Map();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            for (const item of existingData) {
                resultsMap.set(item.row_index, item);
            }
            console.log(`Loaded ${resultsMap.size} existing results from ${OUTPUT_PATH}.`);
        } catch (e) {
            console.warn(`Could not parse existing results: ${e.message}. Starting fresh.`);
        }
    }

    // Perform initial propagation on the loaded resultsMap
    console.log("Running initial CID propagation on loaded results...");
    let initialPropagatedCount = 0;

    // Group currently verified results by URI
    const uriToVerifiedResult = new Map();
    for (const res of resultsMap.values()) {
        if (res.isValid === "Yes" || res.isValid === "No") {
            const target = allTargets.find(t => t.row_index === res.row_index);
            if (target) {
                uriToVerifiedResult.set(target.uri, res);
            }
        }
    }

    for (const [uri, shared] of uriToTargets.entries()) {
        const verifiedRes = uriToVerifiedResult.get(uri);
        if (verifiedRes) {
            for (const target of shared) {
                const existing = resultsMap.get(target.row_index);
                if (!existing || (existing.isValid !== "Yes" && existing.isValid !== "No")) {
                    resultsMap.set(target.row_index, {
                        row_index: target.row_index,
                        isValid: verifiedRes.isValid,
                        isClosed: verifiedRes.isClosed || "No",
                        imageUrl: verifiedRes.imageUrl || ""
                    });
                    initialPropagatedCount++;
                }
            }
        }
    }
    console.log(`Initial propagation resolved ${initialPropagatedCount} additional rows.`);

    // Now identify remaining unique CIDs that need to be scraped
    let targets = [];
    for (const [uri, shared] of uriToTargets.entries()) {
        let isCIDVerified = false;
        for (const target of shared) {
            const res = resultsMap.get(target.row_index);
            if (res && (res.isValid === "Yes" || res.isValid === "No")) {
                isCIDVerified = true;
                break;
            }
        }

        if (!isCIDVerified) {
            // Pick the first target in the group as the representative
            targets.push(shared[0]);
        }
    }

    const totalRemaining = targets.length;
    const limit = process.argv.includes('--all') ? totalRemaining : 10;
    targets = targets.slice(0, limit);
    console.log(`Remaining unknown unique CIDs to check: ${totalRemaining}. Processing current batch of ${targets.length}.`);

    if (targets.length === 0) {
        console.log("All CIDs have been verified! No new unique CIDs to scrape.");
        // Write out resultsMap in case of initial propagation changes
        const mergedResults = Array.from(resultsMap.values());
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedResults, null, 2), 'utf-8');
        return;
    }

    // Split remaining targets into browser-restart batches to prevent OOM
    for (let i = 0; i < targets.length; i += BROWSER_RESTART_INTERVAL) {
        const batch = targets.slice(i, i + BROWSER_RESTART_INTERVAL);
        console.log(`\n--- Processing Batch ${Math.floor(i / BROWSER_RESTART_INTERVAL) + 1} (${batch.length} items) ---`);
        await scrapeBatch(batch, resultsMap);
    }

    console.log(`Finished scraping. Total results: ${resultsMap.size}`);
}

main().catch(console.error);
