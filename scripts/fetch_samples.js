const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeSample() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Foodpanda
    try {
        console.log("Fetching Foodpanda...");
        await page.goto("https://www.foodpanda.sg/restaurant/w2lw/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 30000 });
        const fpBody = await page.innerHTML('body');
        fs.writeFileSync('scratch/foodpanda_sample.html', fpBody);
        console.log("Foodpanda saved.");
    } catch (e) { console.error("Foodpanda failed", e.message); }

    // Deliveroo
    try {
        console.log("Fetching Deliveroo...");
        await page.goto("https://deliveroo.com.sg/menu/singapore/pasir-ris-drive/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 30000 });
        const dlBody = await page.innerHTML('body');
        fs.writeFileSync('scratch/deliveroo_sample.html', dlBody);
        console.log("Deliveroo saved.");
    } catch (e) { console.error("Deliveroo failed", e.message); }

    await browser.close();
}

scrapeSample();
