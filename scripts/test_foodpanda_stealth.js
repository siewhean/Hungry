const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const fs = require('fs');

async function testFoodpanda() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        console.log("Navigating to Foodpanda with stealth...");
        await page.goto("https://www.foodpanda.sg/restaurant/w2lw/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 45000 });
        console.log("Navigation complete.");
        await page.screenshot({ path: 'scratch/foodpanda_stealth.png', fullPage: true });
        console.log("Saved screenshot to scratch/foodpanda_stealth.png");
    } catch (e) {
        console.error("Failed to load:", e.message);
    }

    // Check if we bypassed
    const title = await page.title();
    console.log("Page Title:", title);

    await browser.close();
}

testFoodpanda();
