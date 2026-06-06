#!/usr/bin/env node

const SUPABASE_URL =
  process.env.HUNGRY_SUPABASE_SMOKE_URL ||
  process.env.HUNGRY_SUPABASE_IMPORT_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.HUNGRY_SUPABASE_SMOKE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const REQUIRED = process.env.HUNGRY_SUPABASE_SMOKE_REQUIRED === "1";

const areas = ["Jurong East", "Tampines", "Orchard", "Chinatown", "Woodlands"];

function skip(reason) {
  console.log(JSON.stringify({ status: "skipped", reason }, null, 2));
  process.exit(REQUIRED ? 1 : 0);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  skip("Missing Supabase smoke URL or anon key.");
}

async function rpc(functionName, payload) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${functionName} failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) ? data : [];
}

const results = [];
for (const area of areas) {
  const rows = await rpc("get_discovery_feed_by_location", {
    p_area_name: area,
    p_radius_meters: 3000,
    p_limit: 10,
  });
  results.push({ area, count: rows.length, firstVenue: rows[0]?.venue_name ?? null });
}

const empty = results.filter((result) => result.count === 0);
console.log(JSON.stringify({ status: empty.length ? "failed" : "passed", results }, null, 2));
if (empty.length) {
  process.exit(1);
}
