const { chromium } = require('playwright');
const fs = require('fs');

async function testDeliveroo() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('graphql') || url.includes('api')) {
            try {
                const contentType = res.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const json = await res.json();
                    const str = JSON.stringify(json).toLowerCase();
                    if (str.includes('menu') || str.includes('price')) {
                        console.log("Found Deliveroo JSON:", url);
                        fs.writeFileSync('scratch/deliveroo_intercept.json', JSON.stringify(json, null, 2));
                    }
                }
            } catch(e) {}
        }
    });

    try {
        console.log("Navigating to Deliveroo...");
        await page.goto("https://deliveroo.com.sg/menu/singapore/pasir-ris-drive/the-soup-spoon-union-white-sands", { waitUntil: 'networkidle', timeout: 45000 });
        console.log("Navigation complete.");
        await page.screenshot({ path: 'scratch/deliveroo_test.png', fullPage: true });
        console.log("Saved screenshot to scratch/deliveroo_test.png");
    } catch (e) {
        console.error("Failed to load:", e.message);
    }

    // Check Next.js state
    const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        return script ? script.innerHTML : null;
    });

    if (nextData) {
        console.log("Found __NEXT_DATA__!");
        fs.writeFileSync('scratch/deliveroo_nextdata.json', JSON.stringify(JSON.parse(nextData), null, 2));
    }

    await browser.close();
}

testDeliveroo();
