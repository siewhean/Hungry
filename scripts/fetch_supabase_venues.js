const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching existing venues from Supabase...");
  let allVenues = [];
  let page = 0;
  let pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching from Supabase:", error);
      process.exit(1);
    }

    allVenues = allVenues.concat(data);
    console.log(`Fetched ${data.length} records. Total so far: ${allVenues.length}`);

    if (data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  fs.writeFileSync('data/supabase_venues.json', JSON.stringify(allVenues, null, 2));
  console.log(`Saved ${allVenues.length} Supabase venues to data/supabase_venues.json`);
}

main();
