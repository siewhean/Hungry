const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const SEARCH_ENGINES = [
    (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
    (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
];

let engineIndex = 0;

async function searchWeb(page, query, domain, stallName) {
    let errorCount = 0;
    for (let i = 0; i < SEARCH_ENGINES.length; i++) {
        const engineUrl = SEARCH_ENGINES[engineIndex](query);
        engineIndex = (engineIndex + 1) % SEARCH_ENGINES.length;

        try {
            await page.goto(engineUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const title = await page.title();
            if (title.toLowerCase().includes('captcha') || title.toLowerCase().includes('sorry') || title.toLowerCase().includes('verify')) {
                console.log(`[Search] Engine blocked (Title: ${title}), trying next...`);
                errorCount++;
                continue;
            }

            const targetUrl = await page.evaluate(({ d, sName }) => {
                const anchors = Array.from(document.querySelectorAll('a'));

                const stopWords = ['the', 'and', 'for', 'pte', 'ltd', 'inc', 'co', 'cafe', 'restaurant', 'stall', 'food', 'court', 'delivery'];

                const words = (sName || '').toLowerCase().split(' ')
                    .map(w => w.replace(/[^a-z0-9]/g, ''))
                    .filter(w => w.length > 2 && !stopWords.includes(w));

                const stallFirstWord = words.length > 0 ? words[0] : (sName || '').toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');

                for (const a of anchors) {
                    const href = (a.href || '').toLowerCase();
                    if (href.includes(d)) {
                        const parts = href.split(d);
                        if (parts.length > 1) {
                            const slug = parts[1].split('/')[0].split('?')[0];

                            const slugWords = slug.split('-').filter(w => w.length > 2 && !stopWords.includes(w));
                            const slugFirstWord = slugWords.length > 0 ? slugWords[0] : slug.split('-')[0];

                            if (slugFirstWord === stallFirstWord) {
                                return a.href;
                            }
                        }
                    }
                }
                return null;
            }, { d: domain, sName: stallName });

            if (targetUrl) return { url: targetUrl, blocked: false };

        } catch (e) {
            console.log(`[Search Error] ${e.message}, trying next...`);
            errorCount++;
        }
    }
    return { url: null, blocked: errorCount >= SEARCH_ENGINES.length };
}

async function scrapeDeliveroo(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const nextData = await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            return script ? script.innerHTML : null;
        });

        if (nextData) {
            const data = JSON.parse(nextData);
            const dishes = [];

            // Deliveroo Next.js store structure changes, but generally:
            // props -> pageProps -> initialReduxState -> menu -> categories -> items
            try {
                const state = data.props.initialReduxState || data.props.pageProps.initialReduxState;
                if (state && state.menu && state.menu.items) {
                    const items = Object.values(state.menu.items);
                    for (const item of items) {
                        dishes.push({
                            name: item.name,
                            description: item.description || '',
                            price: item.price ? item.price.fractional / 100 : null,
                            image: item.image ? item.image.url : ''
                        });
                    }
                }
            } catch(e) {}

            if (dishes.length > 0) return dishes;
        }
    } catch(e) {}
    return null;
}

async function scrapeFoodpanda(context, url) {
    const page = await context.newPage();
    let menuData = null;

    page.on('response', async (res) => {
        const u = res.url();
        if (u.includes('api') || u.includes('graphql') || u.includes('menu')) {
            try {
                const contentType = res.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const json = await res.json();
                    const str = JSON.stringify(json).toLowerCase();
                    if (str.includes('dish') || str.includes('price')) {
                        menuData = json;
                    }
                }
            } catch(e) {}
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    } catch(e) {}

    await page.close();

    // Naive parsing of foodpanda json payload
    const dishes = [];
    if (menuData) {
        try {
            // Traverse finding items with name and price
            JSON.stringify(menuData, (key, value) => {
                if (value && value.name && (value.price !== undefined || value.originalPrice !== undefined)) {
                    dishes.push({
                        name: value.name,
                        description: value.description || '',
                        // Missing price stays null (blank), never 0; image kept only when it is a full URL
                        price: value.price || value.originalPrice || null,
                        image: typeof value.image === 'string' && value.image.startsWith('http') ? value.image : ''
                    });
                }
                return value;
            });
        } catch(e) {}
    }

    return dishes.length > 0 ? dishes : null;
}
const CONCURRENCY = 3;

async function main() {
    let stalls = [];
    try {
        stalls = JSON.parse(fs.readFileSync('data/stalls_to_fallback.json', 'utf8'));
    } catch(e) {
        console.error("Failed to load stalls_to_fallback.json");
        return;
    }

    let results = [];
    try {
        if (fs.existsSync('data/fallback_enrichment_results.json')) {
            results = JSON.parse(fs.readFileSync('data/fallback_enrichment_results.json', 'utf8'));
            console.log(`Resuming with ${results.length} previously enriched results.`);
        }
    } catch(e) {}

    const processedIndices = new Set(results.map(r => r.index));

    // Add success names filtering (chain duplicate skipping)
    let successNames = new Set();
    for (const r of results) {
        if (r.dishes && r.dishes.length > 0 && r.stall_name) {
            successNames.add(r.stall_name.toLowerCase().trim());
        }
    }

    const pendingStalls = stalls.filter(s => {
        if (processedIndices.has(s.index)) return false;
        if (s.stall_name && successNames.has(s.stall_name.toLowerCase().trim())) {
            return false; // Skip duplicate chain
        }
        return true;
    });

    console.log(`Loaded ${pendingStalls.length} pending stalls for fallback enrichment.`);
    if (pendingStalls.length === 0) {
        console.log("No remaining stalls to enrich!");
        return;
    }

    const browser = await chromium.launch({ headless: true });
    let index = 0;
    let completedCount = 0;

    async function worker(workerId) {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        while (index < pendingStalls.length) {
            const stall = pendingStalls[index++];
            console.log(`[Worker ${workerId}] [${index}/${pendingStalls.length}] Processing: ${stall.stall_name}`);

            let foundMenu = null;
            let source = null;

            // 1. Try Foodpanda
            const fpSearch = `Foodpanda Singapore ${stall.stall_name} ${stall.building || stall.address}`;
            let fpResult = await searchWeb(page, fpSearch, 'foodpanda.sg/restaurant/', stall.stall_name);
            const fpUrl = fpResult.url;

            if (fpUrl) {
                console.log(`  [Worker ${workerId}] -> Found Foodpanda: ${fpUrl}`);
                foundMenu = await scrapeFoodpanda(context, fpUrl);
                if (foundMenu) source = fpUrl;
            }

            // 2. Try Deliveroo if Foodpanda failed
            let dlResult = { url: null, blocked: false };
            if (!foundMenu) {
                const dlSearch = `Deliveroo Singapore ${stall.stall_name} ${stall.building || stall.address}`;
                dlResult = await searchWeb(page, dlSearch, 'deliveroo.com.sg/menu/', stall.stall_name);
                const dlUrl = dlResult.url;

                if (dlUrl) {
                    console.log(`  [Worker ${workerId}] -> Found Deliveroo: ${dlUrl}`);
                    foundMenu = await scrapeDeliveroo(page, dlUrl);
                    if (foundMenu) source = dlUrl;
                }
            }

            if (foundMenu) {
                console.log(`  [Worker ${workerId}] => Success! Found ${foundMenu.length} dishes from ${source}`);
                results.push({
                    index: stall.index,
                    stall_name: stall.stall_name,
                    source: source,
                    dishes: foundMenu
                });
            } else {
                if (fpResult.blocked || dlResult.blocked) {
                    console.log(`  [Worker ${workerId}] => Skipping caching as failure because search engine blocked us.`);
                } else {
                    console.log(`  [Worker ${workerId}] => Failed to find any fallback menus.`);
                    results.push({
                        index: stall.index,
                        stall_name: stall.stall_name,
                        source: null,
                        dishes: null
                    });
                }
            }

            completedCount++;
            if (completedCount % 10 === 0) {
                fs.writeFileSync('data/fallback_enrichment_results.json', JSON.stringify(results, null, 4));
            }
        }
        await context.close();
    }

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(worker(i + 1));
    }

    await Promise.all(workers);

    // Final save
    fs.writeFileSync('data/fallback_enrichment_results.json', JSON.stringify(results, null, 4));
    console.log("Fallback loop complete.");
    await browser.close();
}

main();
