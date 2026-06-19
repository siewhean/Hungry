const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const INPUT_PATH = path.join(__dirname, '..', 'data', 'stalls_to_enrich.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'menu_enrichment_results.json');

const CONCURRENCY = 15; // Concurrent workers
const SAVE_INTERVAL = 10; // Save to disk every 10 stalls

// Load environment variables
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.lingshi.chat';

async function searchYahoo(page, query) {
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Extract GrabFood link
        const grabUrl = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            for (const a of anchors) {
                const href = a.href || '';
                if (href.includes('food.grab.com/sg/en/restaurant/')) {
                    return href;
                }
            }
            return null;
        });
        return grabUrl;
    } catch (e) {
        console.error(`[Search Error] Failed searching for "${query}": ${e.message}`);
        return null;
    }
}

async function scrapeGrabMenu(page, url, coords) {
    try {
        // Set geolocation if coords exist
        if (coords && coords.latitude && coords.longitude) {
            await page.context().setGeolocation({
                latitude: parseFloat(coords.latitude),
                longitude: parseFloat(coords.longitude)
            });
        } else {
            // Default to Holland Village Singapore
            await page.context().setGeolocation({ latitude: 1.3120, longitude: 103.7962 });
        }

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(5000); // Wait for dynamic menus to render

        const dishes = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('[class*="menuItem___"], [class*="menuItem"]'));
            // Filter to keep only the outermost matching elements
            const itemEls = allEls.filter(el => {
                let p = el.parentElement;
                while (p) {
                    if (allEls.includes(p)) return false;
                    p = p.parentElement;
                }
                return true;
            });

            const results = [];
            itemEls.forEach(el => {
                const nameEl = el.querySelector('[class*="itemNameTitle"], [class*="itemName"]');
                const priceEl = el.querySelector('[class*="itemPrice"], [class*="price"]');
                const descEl = el.querySelector('[class*="itemDescription"], [class*="description"]');
                const imgEl = el.querySelector('img');

                if (nameEl) {
                    let name = nameEl.textContent.trim();
                    const desc = descEl ? descEl.textContent.trim() : '';
                    const priceText = priceEl ? priceEl.textContent.trim() : '';

                    // Clean price text (extract number)
                    let price = 0;
                    const priceMatch = priceText.replace(/[^0-9.]/g, '');
                    if (priceMatch) {
                        price = parseFloat(priceMatch);
                    }

                    // Clean name if it repeats description
                    if (desc && name.endsWith(desc)) {
                        name = name.slice(0, -desc.length).trim();
                    }

                    const imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : '';

                    results.push({
                        name,
                        price,
                        description: desc,
                        imageUrl: imageUrl.startsWith('http') ? imageUrl : ''
                    });
                }
            });
            return results;
        });

        return dishes;
    } catch (e) {
        console.error(`[Scrape Error] Failed scraping GrabFood URL "${url}": ${e.message}`);
        return null;
    }
}

function callClaudeAPI(stallName, cuisine, building) {
    return new Promise((resolve, reject) => {
        if (!ANTHROPIC_AUTH_TOKEN) {
            return reject(new Error("ANTHROPIC_AUTH_TOKEN not set"));
        }

        const payload = {
            model: "claude-sonnet-4-5",
            messages: [{
                role: "user",
                content: `You are a Singaporean food guide. Generate an extensive, realistic menu of 10-15 dishes for a stall named "${stallName}" serving "${cuisine || 'Local'}" cuisine at "${building || 'Singapore Food Centre'}".
For each dish, provide:
1. "name": The clean dish name (e.g. "Hainanese Chicken Rice").
2. "price": A realistic price in SGD (e.g. 5.50).
3. "description": A short appetizing description.
4. "imageUrl": A specific, high-quality, real Unsplash food image URL (e.g., "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60") matching this type of food. Avoid generic placeholder images. Ensure each dish has a unique and relevant Unsplash photo ID.

Output the response as a JSON array of objects with keys: name, price, description, imageUrl. Do not include markdown code block formatting or any other text, just the raw JSON array.`
            }],
            max_tokens: 1500
        };

        const postData = JSON.stringify(payload);
        const options = {
            hostname: ANTHROPIC_BASE_URL.replace('https://', ''),
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANTHROPIC_AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 90000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Claude API HTTP ${res.statusCode}: ${body}`));
                }
                try {
                    const parsed = JSON.parse(body);
                    const textContent = parsed.choices[0].message.content.trim();

                    // Clean up markdown block if model output it
                    let cleanJson = textContent;
                    if (cleanJson.startsWith('```')) {
                        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                    }

                    const dishes = JSON.parse(cleanJson);
                    resolve(dishes);
                } catch (e) {
                    reject(new Error(`Failed to parse Claude response: ${e.message}\nResponse body: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Claude API request timeout"));
        });
        req.write(postData);
        req.end();
    });
}

async function main() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error(`Input file not found at ${INPUT_PATH}. Run prepare_enrichment_list.py first.`);
        process.exit(1);
    }

    const stalls = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
    console.log(`Loaded ${stalls.length} unique active stalls to enrich.`);

    // Load existing results
    let resultsMap = new Map();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            for (const item of existing) {
                resultsMap.set(item.uri, item);
            }
            console.log(`Loaded ${resultsMap.size} existing enriched results.`);
        } catch (e) {
            console.warn(`Could not parse existing results: ${e.message}. Starting fresh.`);
        }
    }

    // Filter remaining stalls
    let remainingStalls = stalls.filter(s => !resultsMap.has(s.uri));
    console.log(`Remaining stalls to process: ${remainingStalls.length}`);

    // Limit processing count if argument is passed, e.g. --limit 10
    const limitArgIdx = process.argv.indexOf('--limit');
    let limit = remainingStalls.length;
    if (limitArgIdx !== -1 && limitArgIdx + 1 < process.argv.length) {
        limit = parseInt(process.argv[limitArgIdx + 1], 10);
    }
    remainingStalls = remainingStalls.slice(0, limit);
    console.log(`Processing limit set to: ${remainingStalls.length}`);

    if (remainingStalls.length === 0) {
        console.log("No remaining stalls to enrich!");
        return;
    }

    const browser = await chromium.launch({ headless: true });

    let index = 0;
    let completedCount = 0;

    function saveResults() {
        const merged = Array.from(resultsMap.values());
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), 'utf-8');
        console.log(`[Checkpoint] Saved ${merged.length} enriched results to ${OUTPUT_PATH}`);
    }

    async function worker(workerId) {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            geolocation: { latitude: 1.3120, longitude: 103.7962 },
            permissions: ['geolocation']
        });
        const page = await context.newPage();

        while (index < remainingStalls.length) {
            const stall = remainingStalls[index++];
            console.log(`[Worker ${workerId}] [${index}/${remainingStalls.length}] Processing stall: ${stall.stall_name} (${stall.building || stall.address})`);

            let result = {
                uri: stall.uri,
                stall_name: stall.stall_name,
                building: stall.building,
                address: stall.address,
                source: null,
                dishes: []
            };

            // Step 1: Search Yahoo for GrabFood
            const searchQuery = `GrabFood Singapore ${stall.stall_name} ${stall.building || stall.address}`;
            const grabUrl = await searchYahoo(page, searchQuery);

            if (grabUrl) {
                console.log(`   -> Found GrabFood URL: ${grabUrl}`);
                // Step 2: Scrape GrabFood
                const dishes = await scrapeGrabMenu(page, grabUrl, { latitude: stall.latitude, longitude: stall.longitude });
                if (dishes && dishes.length > 0) {
                    console.log(`   -> Successfully scraped ${dishes.length} dishes from GrabFood.`);
                    result.source = "grabfood";
                    result.url = grabUrl;
                    result.dishes = dishes;
                }
            }

            // Step 3: Fallback to Claude AI menu generation if GrabFood scraping failed or was not found
            if (result.dishes.length === 0) {
                console.log(`   -> Fallback: Generating menu with Claude AI for ${stall.stall_name}...`);
                try {
                    const generated = await callClaudeAPI(stall.stall_name, stall.existing_menu || stall.stall_name, stall.building || stall.address);
                    if (generated && generated.length > 0) {
                        console.log(`   -> Successfully generated ${generated.length} dishes via Claude.`);
                        result.source = "claude-fallback";
                        result.dishes = generated;
                    }
                } catch (e) {
                    console.error(`   -> Claude generation failed: ${e.message}`);
                }
            }

            // If we have dishes, save them
            if (result.dishes.length > 0) {
                resultsMap.set(stall.uri, result);
            } else {
                console.error(`   -> Failed to enrich stall ${stall.stall_name}. No dishes generated.`);
            }

            completedCount++;
            if (completedCount % SAVE_INTERVAL === 0) {
                saveResults();
            }

            // Add a small delay between tasks to be nice
            await page.waitForTimeout(1000 + Math.random() * 1000);
        }

        await context.close();
    }

    const workerPromises = [];
    const numWorkers = Math.min(CONCURRENCY, remainingStalls.length);
    console.log(`Spawning ${numWorkers} parallel workers...`);
    for (let i = 0; i < numWorkers; i++) {
        workerPromises.push(worker(i + 1));
    }

    await Promise.all(workerPromises);
    await browser.close();
    saveResults();
    console.log("Enrichment run complete.");
}

main().catch(console.error);
