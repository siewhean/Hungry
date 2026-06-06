#!/usr/bin/env node

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

console.log(
  JSON.stringify(
    {
      status: writesRejected ? "passed" : "failed",
      areasReadStatus: readAreas.status,
      anonWriteStatuses: {
        areas: writeArea.status,
        venue_images: writeVenueImage.status,
      },
    },
    null,
    2,
  ),
);

if (!writesRejected) {
  process.exit(1);
}
