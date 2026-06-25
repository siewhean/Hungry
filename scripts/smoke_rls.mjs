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

function skip(reason) {
  console.log(JSON.stringify({ status: "skipped", reason }, null, 2));
  process.exit(REQUIRED ? 1 : 0);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  skip("Missing Supabase smoke URL or anon key.");
}

const baseUrl = SUPABASE_URL.replace(/\/$/, "");
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const readAreas = await fetch(`${baseUrl}/rest/v1/areas?select=name&limit=1`, { headers });
const readBody = await readAreas.text();
if (!readAreas.ok) {
  throw new Error(`Anon areas read failed ${readAreas.status}: ${readBody}`);
}

const writeArea = await fetch(`${baseUrl}/rest/v1/areas`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=minimal" },
  body: JSON.stringify({ name: "Smoke Forbidden", name_normalized: "smoke forbidden" }),
});

const writeVenueImage = await fetch(`${baseUrl}/rest/v1/venue_images`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=minimal" },
  body: JSON.stringify({ venue_id: "smoke", url: "https://example.com/smoke.jpg" }),
});

const writeStatuses = [writeArea.status, writeVenueImage.status];
const writesRejected = writeStatuses.every((status) => [401, 403, 404, 405].includes(status));
const deniedStatuses = new Set([401, 403, 404, 405]);
const serviceOnlyTables = [
  "activity_events",
  "app_ops_admins",
  "app_ops_audit_events",
  "app_ops_rate_limits",
  "app_user_rate_limits",
  "dishes_draft",
  "guest_sessions",
  "menu_photo_submissions",
  "merchant_claim_interests",
  "merchant_popular_visitor_pins",
  "website_console_admins",
  "website_console_audit_events",
];

async function restRequest(table, init) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}`, init);
  const body = await response.text();
  let rows = null;
  if (response.ok && body) {
    try {
      const parsed = JSON.parse(body);
      rows = Array.isArray(parsed) ? parsed.length : null;
    } catch {
      rows = null;
    }
  }
  return {
    body,
    ok: response.ok,
    rows,
    status: response.status,
    table,
  };
}

const serviceOnlyResults = [];
for (const table of serviceOnlyTables) {
  const read = await restRequest(`${table}?select=*&limit=1`, { headers });
  const write = await restRequest(table, {
    body: JSON.stringify({}),
    headers: { ...headers, Prefer: "return=minimal" },
    method: "POST",
  });
  serviceOnlyResults.push({
    read: read.status,
    rows: read.rows,
    table,
    write: write.status,
  });
}

const serviceOnlyDenied = serviceOnlyResults.every(
  (result) =>
    (deniedStatuses.has(result.read) || (result.read === 200 && result.rows === 0)) &&
    deniedStatuses.has(result.write),
);

console.log(
  JSON.stringify(
    {
      status: writesRejected && serviceOnlyDenied ? "passed" : "failed",
      areasReadStatus: readAreas.status,
      anonWriteStatuses: {
        areas: writeArea.status,
        venue_images: writeVenueImage.status,
      },
      serviceOnlyTables: serviceOnlyResults,
    },
    null,
    2,
  ),
);

if (!writesRejected || !serviceOnlyDenied) {
  process.exit(1);
}
