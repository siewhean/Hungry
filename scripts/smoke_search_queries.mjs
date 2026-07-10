#!/usr/bin/env node

import { loadProjectEnv } from "./load-project-env.mjs";

loadProjectEnv();

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchOnce(query, overrides = {}) {
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
      ...overrides,
    }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) {
    throw new Error(`search_dishes(${query}) failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) ? data : [];
}

async function search(query, overrides = {}) {
  try {
    return await searchOnce(query, overrides);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('"code":"57014"')) {
      throw error;
    }
    await sleep(500);
    return searchOnce(query, overrides);
  }
}

const results = [];
for (const query of queries) {
  const rows = await search(query);
  results.push({ query, count: rows.length, firstDish: rows[0]?.name ?? null });
}

const filteredChecks = [
  {
    name: "price filter",
    rows: await search("chicken rice", { p_max_price: 10 }),
  },
  {
    name: "open-only filter",
    rows: await search("chicken rice", { p_open_only: true }),
  },
  {
    name: "invalid explicit area",
    rows: await search("chicken rice", { p_area_name: "__invalid_area__" }),
    expectedCount: 0,
  },
];

const empty = results.filter((result) => result.count === 0);
const failedFilteredChecks = filteredChecks.filter(
  (check) => typeof check.expectedCount === "number" && check.rows.length !== check.expectedCount,
);
console.log(
  JSON.stringify(
    {
      status: empty.length || failedFilteredChecks.length ? "failed" : "passed",
      results,
      filteredChecks: filteredChecks.map((check) => ({
        name: check.name,
        count: check.rows.length,
        firstDish: check.rows[0]?.name ?? null,
        expectedCount: check.expectedCount,
      })),
    },
    null,
    2,
  ),
);
if (empty.length || failedFilteredChecks.length) {
  process.exit(1);
}
