const { chromium } = require('playwright');
const fs = require('fs');

async function testFoodpanda() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    let menuData = null;

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('api') || url.includes('graphql') || url.includes('menu')) {
            try {
                const contentType = res.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const json = await res.json();

                    // Foodpanda usually has a data structure with menus or products
                    const stringified = JSON.stringify(json).toLowerCase();
                    if (stringified.includes('dish') || stringified.includes('menu') || stringified.includes('price')) {
                        console.log(`Found JSON payload from: ${url}`);
                        fs.writeFileSync('scratch/foodpanda_intercept.json', JSON.stringify(json, null, 2));
                        menuData = json;
                    }
                }
            } catch (e) {
                // Ignore parse errors for binary or aborted requests
            }
        }
    });

    try {
        console.log("Navigating to Foodpanda...");
        await page.goto("https://www.foodpanda.sg/restaurant/w2lw/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 45000 });
        console.log("Navigation complete.");
    } catch (e) {
        console.error("Failed to load:", e.message);
    }

    // Also, Foodpanda embeds their state directly in the HTML sometimes.
    const stateScript = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
            if (s.innerHTML.includes('window.__PRELOADED_STATE__')) {
                return s.innerHTML;
            }
        }
        return null;
    });

    if (stateScript) {
        console.log("Found window.__PRELOADED_STATE__!");
        fs.writeFileSync('scratch/foodpanda_preloaded.txt', stateScript);
    }

    await browser.close();
}

testFoodpanda();
