const fs = require('fs');
const path = require('path');

const files = [
    path.join(__dirname, '..', 'data', 'menu_enrichment_results.json'),
    path.join(__dirname, '..', 'data', 'fallback_enrichment_results.json')
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;

    console.log(`Checking ${path.basename(file)}...`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const originalLength = data.length;

    const stopWords = ['the', 'and', 'for', 'pte', 'ltd', 'inc', 'co', 'cafe', 'restaurant', 'stall', 'food', 'court', 'delivery'];

    const cleaned = data.filter(item => {
        let urlStr = (item.url || item.source || '').toLowerCase();

        if (urlStr.includes('food.grab.com/sg/en/restaurant/')) {
            const words = (item.stall_name || '').toLowerCase().split(' ')
                .map(w => w.replace(/[^a-z0-9]/g, ''))
                .filter(w => w.length > 2 && !stopWords.includes(w));

            const stallFirstWord = words.length > 0 ? words[0] : (item.stall_name || '').toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');

            const parts = urlStr.split('/restaurant/');
            if (parts.length > 1) {
                const slug = parts[1].split('/')[0];
                const slugWords = slug.split('-').filter(w => w.length > 2 && !stopWords.includes(w));
                const slugFirstWord = slugWords.length > 0 ? slugWords[0] : slug.split('-')[0];

                if (slugFirstWord !== stallFirstWord) {
                    return false;
                }
            }
        }

        return true;
    });

    if (cleaned.length < originalLength) {
        fs.writeFileSync(file, JSON.stringify(cleaned, null, 4));
        console.log(`Cleaned ${originalLength - cleaned.length} completely unrelated ad links from ${path.basename(file)}.`);
    } else {
        console.log(`No unrelated links found in ${path.basename(file)}.`);
    }
}
