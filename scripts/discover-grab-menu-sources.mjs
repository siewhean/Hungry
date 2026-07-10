#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-project-env.mjs";
import { extractGrabDirectoryCandidates, matchGrabCandidates } from "./lib/grab-directory-discovery.mjs";

loadProjectEnv();

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const outPath = path.resolve(String(args.out || "scratch/grab-menu-source-discovery.json"));
const inputs = listArg(args.input);
const directoryUrls = listArg(args["directory-url"]);
const limit = positiveInt(args.limit, 5000);
const pages = positiveInt(args.pages, 1);
const pauseMs = Math.max(1000, positiveInt(args["pause-ms"], 5000));

if (args.help === true) {
  console.log("Usage: node scripts/discover-grab-menu-sources.mjs (--input=FILE | --directory-url=URL) [options]");
  console.log("Options: --venues-json=FILE --limit=5000 --pages=1 --out=PATH --min-name-score=0.72 --min-confidence=0.82 --min-margin=0.08 --apply");
  console.log("Dry-run is the default; --apply requires a service-role key and only fills null menu_source_url values.");
  process.exit(0);
}

const url = process.env.HUNGRY_SUPABASE_IMPORT_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!args["venues-json"] && (!url || !key)) {
  throw new Error("Supabase credentials are required unless --venues-json is provided.");
}
if (apply && !process.env.HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("--apply requires a Supabase service-role key.");
}
if (!inputs.length && !directoryUrls.length) {
  throw new Error("Provide --input=payload.json or --directory-url=https://food.grab.com/... (comma-separated values supported).");
}

const payloads = [];
for (const input of inputs) payloads.push(JSON.parse(await fs.readFile(path.resolve(input), "utf8")));
for (const directoryUrl of directoryUrls) {
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    payloads.push(await fetchDirectoryPayload(directoryUrl, pageNumber));
    if (pageNumber < pages) await wait(pauseMs);
  }
}

const candidates = dedupe(payloads.flatMap(extractGrabDirectoryCandidates), (row) => `${row.url}|${row.postalCode || ""}`);
const venues = args["venues-json"]
  ? JSON.parse(await fs.readFile(path.resolve(String(args["venues-json"])), "utf8"))
  : await fetchVenueQueue(createClient(url, key), limit);
const proposals = matchGrabCandidates(venues.slice(0, limit), candidates, {
  minNameScore: numberArg(args["min-name-score"], 0.72),
  minConfidence: numberArg(args["min-confidence"], 0.82),
  minMargin: numberArg(args["min-margin"], 0.08),
});
const approved = proposals.filter((row) => row.status === "approved");

const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry_run",
  inputs: { files: inputs, directoryUrls, pages, limit },
  stats: {
    venuesScanned: Math.min(venues.length, limit),
    grabCandidates: candidates.length,
    proposals: proposals.length,
    approved: approved.length,
    manualReview: proposals.length - approved.length,
    applied: 0,
  },
  proposals,
};

if (apply) {
  const client = createClient(url, key);
  for (const row of approved) {
    const { data, error } = await client
      .from("venues")
      .update({ menu_source_url: row.menuSourceUrl })
      .eq("id", row.venueId)
      .is("menu_source_url", null)
      .select("id");
    if (error) throw error;
    report.stats.applied += data?.length || 0;
  }
}

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: "passed", out: outPath, ...report.stats }, null, 2));

async function fetchVenueQueue(client, maxRows) {
  const rows = [];
  for (let from = 0; rows.length < maxRows; from += 1000) {
    const { data, error } = await client
      .from("venues")
      .select("id,name,address,postal_code,menu_source_url")
      .is("menu_source_url", null)
      .order("id", { ascending: true })
      .range(from, Math.min(from + 999, maxRows - 1));
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchDirectoryPayload(baseUrl, pageNumber) {
  const target = new URL(baseUrl);
  if (pageNumber > 1 || !target.searchParams.has("page")) target.searchParams.set("page", String(pageNumber));
  const response = await fetch(target, {
    headers: { "user-agent": "Mozilla/5.0 HungryDataOps/1.0", accept: "text/html,application/json" },
  });
  if (!response.ok) throw new Error(`Grab directory fetch failed (${response.status}) for ${target}`);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (/json/i.test(contentType) || /^\s*[\[{]/.test(text)) return JSON.parse(text);
  const match = text.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error(`No __NEXT_DATA__ payload found for ${target}`);
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    const value = rest.length ? rest.join("=") : true;
    if (parsed[key] === undefined) parsed[key] = value;
    else parsed[key] = `${parsed[key]},${value}`;
  }
  return parsed;
}

function listArg(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dedupe(rows, keyFor) {
  return [...new Map(rows.map((row) => [keyFor(row), row])).values()];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
