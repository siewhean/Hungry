const cheerio = require('cheerio');
const fs = require('fs');

function analyzeFoodpanda() {
    console.log("--- Foodpanda Analysis ---");
    const html = fs.readFileSync('scratch/foodpanda_sample.html', 'utf8');
    const $ = cheerio.load(html);

    // Most SPA sites have JSON in a <script> tag
    const scripts = $('script').toArray();
    for (const script of scripts) {
        const text = $(script).html();
        if (text && text.includes('__PRELOADED_STATE__') || text.includes('window.reduxState') || text.includes('__NEXT_DATA__')) {
            console.log("Found potential state data script! Length:", text.length);
        }
    }

    // Checking UI elements
    const dishes = $('[data-testid="menu-item"]').toArray();
    console.log("Found menu items using data-testid:", dishes.length);
    if (dishes.length > 0) {
        const first = $(dishes[0]);
        console.log("First item:", first.text().substring(0, 50));
    } else {
        const fallback = $('.dish-name').toArray();
        console.log("Found menu items using .dish-name:", fallback.length);
    }
}

function analyzeDeliveroo() {
    console.log("--- Deliveroo Analysis ---");
    const html = fs.readFileSync('scratch/deliveroo_sample.html', 'utf8');
    const $ = cheerio.load(html);

    const scripts = $('script').toArray();
    for (const script of scripts) {
        const text = $(script).html();
        if (text && text.includes('__NEXT_DATA__')) {
            console.log("Found Next.js data script! Length:", text.length);
        }
    }

    const dishes = $('li.menu-index-page-item').toArray();
    console.log("Found menu items using li.menu-index-page-item:", dishes.length);
}

analyzeFoodpanda();
analyzeDeliveroo();
