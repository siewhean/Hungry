#!/usr/bin/env node

const SUPABASE_URL =
  process.env.HUNGRY_SUPABASE_SMOKE_URL ||
  process.env.HUNGRY_SUPABASE_IMPORT_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.HUNGRY_SUPABASE_SMOKE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const REQUIRED = process.env.HUNGRY_SUPABASE_SMOKE_REQUIRED === "1";

const queries = ["chicken rice", "laksa", "nasi lemak", "tampines", "jurong"];

function skip(reason) {
  console.log(JSON.stringify({ status: "skipped", reason }, null, 2));
  process.exit(REQUIRED ? 1 : 0);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  skip("Missing Supabase smoke URL or anon key.");
}

async function search(query) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/search_dishes`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_query: query,
      p_radius_meters: null,
      p_dietary_flags: [],
      p_limit: 10,
      p_cursor_score: null,
      p_cursor_id: null,
      p_venue_id: null,
      p_area_name: null,
      p_cuisine_tags: null,
      p_max_price: null,
      p_open_only: false,
    }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) {
    throw new Error(`search_dishes(${query}) failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) ? data : [];
}

const results = [];
for (const query of queries) {
  const rows = await search(query);
  results.push({ query, count: rows.length, firstDish: rows[0]?.name ?? null });
}

const empty = results.filter((result) => result.count === 0);
console.log(JSON.stringify({ status: empty.length ? "failed" : "passed", results }, null, 2));
if (empty.length) {
  process.exit(1);
}
