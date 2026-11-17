const { chromium } = require('playwright');
const fs = require('fs');

async function testFoodpanda() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        console.log("Navigating to Foodpanda...");
        await page.goto("https://www.foodpanda.sg/restaurant/w2lw/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 45000 });
        console.log("Navigation complete.");
        await page.screenshot({ path: 'scratch/foodpanda_test.png', fullPage: true });
        console.log("Saved screenshot to scratch/foodpanda_test.png");
    } catch (e) {
        console.error("Failed to load:", e.message);
    }

    await browser.close();
}

testFoodpanda();
