#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "data", "menu_enrichment_results.json");
const DEFAULT_ENV = path.join(ROOT, ".env.local");
const IMPORT_URL_ENV = "HUNGRY_SUPABASE_IMPORT_URL";
const IMPORT_KEY_ENV = "HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY";
const IMPORT_PROJECT_REF_ENV = "HUNGRY_SUPABASE_IMPORT_PROJECT_REF";
const IMPORT_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_IMPORT";
const GRAB_LICENSE_OPT_IN_ENV = "HUNGRY_ALLOW_GRAB_LICENSED_MEDIA";
const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;

function parseArgs(argv) {
  const args = {
    apply: false,
    envPath: DEFAULT_ENV,
    sourcePath: DEFAULT_SOURCE,
    approveLicensedGrabMedia: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--approve-licensed-grab-media") {
      args.approveLicensedGrabMedia = true;
    } else if (arg === "--env") {
      args.envPath = path.resolve(argv[++index]);
    } else if (arg === "--source") {
      args.sourcePath = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function requireImportEnv() {
  if (process.env[IMPORT_OPT_IN_ENV] !== "1") {
    throw new Error(`Set ${IMPORT_OPT_IN_ENV}=1 to allow service-role import.`);
  }
  const baseUrl = (process.env[IMPORT_URL_ENV] ?? "").trim().replace(/\/$/, "");
  const serviceKey = (process.env[IMPORT_KEY_ENV] ?? "").trim();
  const expectedRef = (process.env[IMPORT_PROJECT_REF_ENV] ?? "").trim();
  const missing = [
    [IMPORT_URL_ENV, baseUrl],
    [IMPORT_KEY_ENV, serviceKey],
    [IMPORT_PROJECT_REF_ENV, expectedRef],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required import environment: ${missing.join(", ")}`);
  }
  const actualRef = new URL(baseUrl).hostname.split(".")[0];
  if (actualRef !== expectedRef) {
    throw new Error(`${IMPORT_PROJECT_REF_ENV} does not match ${IMPORT_URL_ENV} project ref.`);
  }
  return { baseUrl, serviceKey };
}

function requireLicensedMediaApproval(args) {
  if (!args.approveLicensedGrabMedia) return;
  if (process.env[GRAB_LICENSE_OPT_IN_ENV] !== "1") {
    throw new Error(
      `Set ${GRAB_LICENSE_OPT_IN_ENV}=1 with --approve-licensed-grab-media to mark Grab media display-approved.`,
    );
  }
}

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
}

export function overlapScore(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function clean(value) {
  return String(value ?? "").trim();
}

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

export function isRealGrabFoodImage(url) {
  return /^https:\/\/huawei-food-cms\.grab\.com\/.+/i.test(clean(url));
}

function priceRange(price) {
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? `$${price.toFixed(2)}`
    : "";
}

function requestHeaders(serviceKey, prefer = "") {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function restRequest({ baseUrl, serviceKey }, method, table, query = "", body = undefined, prefer = "") {
  const response = await fetch(`${baseUrl}/rest/v1/${table}${query}`, {
    method,
    headers: requestHeaders(serviceKey, prefer),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${method} ${table} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function fetchAll(client, table, select) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const query = `?select=${encodeURIComponent(select)}&order=id.asc`;
    const page = await fetch(`${client.baseUrl}/rest/v1/${table}${query}`, {
      headers: {
        ...requestHeaders(client.serviceKey),
        Range: `${from}-${to}`,
      },
    });
    if (!page.ok) {
      const detail = await page.text();
      throw new Error(`GET ${table} failed (${page.status}): ${detail.slice(0, 500)}`);
    }
    const pageRows = await page.json();
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
  }
}

function readGrabRows(sourcePath) {
  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const grabStalls = parsed.filter((item) => item?.source === "grabfood");
  const dishRows = [];
  grabStalls.forEach((stall, stallIndex) => {
    const sourceUrl = clean(stall.url) || clean(stall.uri);
    (stall.dishes ?? []).forEach((dish, dishIndex) => {
      const dishName = clean(dish.name);
      if (!dishName) return;
      const rawImageUrl = clean(dish.imageUrl);
      const imageUrl = isRealGrabFoodImage(rawImageUrl) ? rawImageUrl : "";
      dishRows.push({
        stallIndex,
        dishIndex,
        stallName: clean(stall.stall_name),
        buildingName: clean(stall.building),
        address: clean(stall.address),
        mapsUri: clean(stall.uri),
        sourceUrl,
        dishName,
        description: clean(dish.description),
        price: typeof dish.price === "number" && Number.isFinite(dish.price) ? dish.price : 0,
        rawImageUrl,
        imageUrl,
      });
    });
  });
  return { grabStalls, dishRows };
}

export function buildVenueMatcher(venues, buildings) {
  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  const venuesByName = new Map();
  const venuesByAddress = new Map();
  const venuesByToken = new Map();
  for (const venue of venues) {
    const key = normalize(venue.name);
    const building = buildingById.get(venue.building_id) ?? {};
    const entry = {
      ...venue,
      business_id: clean(venue.business_id) || clean(venue.id).replace(/^ven-/, ""),
      normalizedBuilding: normalize(building.name),
      normalizedAddress: normalize(venue.address || building.address),
    };
    if (entry.normalizedAddress) {
      const addressList = venuesByAddress.get(entry.normalizedAddress) ?? [];
      addressList.push(entry);
      venuesByAddress.set(entry.normalizedAddress, addressList);
    }
    if (key) {
      const list = venuesByName.get(key) ?? [];
      list.push(entry);
      venuesByName.set(key, list);
      for (const token of tokenSet(venue.name)) {
        const tokenList = venuesByToken.get(token) ?? [];
        tokenList.push(entry);
        venuesByToken.set(token, tokenList);
      }
    }
  }

  return (stall) => {
    const candidates = venuesByName.get(normalize(stall.stallName)) ?? [];
    const ranked = candidates
      .map((venue) => {
        const buildingRank = venue.normalizedBuilding && venue.normalizedBuilding === normalize(stall.buildingName) ? 1 : 9;
        const addressRank = venue.normalizedAddress && venue.normalizedAddress === normalize(stall.address) ? 2 : 9;
        const rank = Math.min(buildingRank, addressRank, 3);
        return { venue, rank };
      })
      .sort((left, right) => left.rank - right.rank || clean(left.venue.id).localeCompare(clean(right.venue.id)));
    if (ranked[0]?.rank < 3) return ranked[0].venue;
    if (ranked.length === 1) return ranked[0].venue;

    const addressCandidates = venuesByAddress.get(normalize(stall.address)) ?? [];
    const fuzzyAddressMatches = addressCandidates
      .map((venue) => ({ venue, score: overlapScore(stall.stallName, venue.name) }))
      .filter((item) => item.score >= 0.5)
      .sort((left, right) => right.score - left.score || clean(left.venue.id).localeCompare(clean(right.venue.id)));
    if (fuzzyAddressMatches[0]?.venue) return fuzzyAddressMatches[0].venue;

    const tokenCandidates = new Map();
    for (const token of tokenSet(stall.stallName)) {
      for (const venue of venuesByToken.get(token) ?? []) {
        tokenCandidates.set(venue.id, venue);
      }
    }
    const containmentMatches = [...tokenCandidates.values()]
      .map((venue) => ({ venue, score: overlapScore(stall.stallName, venue.name) }))
      .filter((item) => item.score >= 0.8)
      .sort((left, right) => right.score - left.score || clean(left.venue.id).localeCompare(clean(right.venue.id)));
    const topScore = containmentMatches[0]?.score ?? 0;
    const sameScoreCount = containmentMatches.filter((item) => item.score === topScore).length;
    return topScore > 0 && sameScoreCount === 1 ? containmentMatches[0].venue : null;
  };
}

export function buildCatalogRows(dishRows, matchVenue, options = {}) {
  const approveLicensedGrabMedia = options.approveLicensedGrabMedia === true;
  const unmatchedStalls = new Map();
  const dishById = new Map();
  const imageByDishId = new Map();
  const matchedStalls = new Set();
  const now = new Date().toISOString();

  for (const source of dishRows) {
    const venue = matchVenue(source);
    if (!venue) {
      unmatchedStalls.set(
        `${source.stallName}|${source.buildingName}|${source.address}`,
        { stallName: source.stallName, buildingName: source.buildingName, address: source.address },
      );
      continue;
    }
    matchedStalls.add(source.stallIndex);
    const dishId = `dsh-menu-${md5(`${venue.business_id}:${source.dishName.toLowerCase()}`)}`;
    const current = dishById.get(dishId);
    if (!current || (!current.image_url && source.imageUrl)) {
      dishById.set(dishId, {
        id: dishId,
        venue_id: venue.id,
        building_id: venue.building_id,
        name: source.dishName,
        description: source.description || null,
        price: source.price,
        price_range: priceRange(source.price),
        cuisine_tags: [],
        taste_tags: [],
        availability_flags: [],
        must_order: false,
        is_featured: false,
        source_type: "scraped_menu_item",
        source_confidence: 0.95,
        menu_approved_for_display: approveLicensedGrabMedia,
        menu_rights_status: approveLicensedGrabMedia ? "licensed" : "unverified",
        menu_source_url: source.sourceUrl || null,
        menu_verified_at: approveLicensedGrabMedia ? now : null,
        media_approved_for_display: false,
        media_rights_status: "unverified",
        media_source_url: null,
        updated_at: now,
      });
    }
    if (source.imageUrl && !imageByDishId.has(dishId)) {
      imageByDishId.set(dishId, {
        dish_id: dishId,
        url: source.imageUrl,
        sort_order: 0,
        media_approved_for_display: approveLicensedGrabMedia,
        media_rights_status: approveLicensedGrabMedia ? "licensed" : "unverified",
        media_source_url: source.sourceUrl || null,
        media_verified_at: approveLicensedGrabMedia ? now : null,
      });
    }
  }

  return {
    dishes: [...dishById.values()],
    dishImages: [...imageByDishId.values()],
    unmatchedStalls: [...unmatchedStalls.values()],
    matchedStallCount: matchedStalls.size,
  };
}

async function upsertBatches(client, table, rows, conflictTarget) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    await restRequest(
      client,
      "POST",
      table,
      `?on_conflict=${encodeURIComponent(conflictTarget)}`,
      batch,
      "resolution=merge-duplicates,return=minimal",
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvFile(args.envPath);
  const client = requireImportEnv();
  requireLicensedMediaApproval(args);
  const { grabStalls, dishRows } = readGrabRows(args.sourcePath);
  const venues = (await fetchAll(client, "venues", "id,business_id,name,building_id,address")).filter(
    (venue) => clean(venue.id).startsWith("ven-") && clean(venue.building_id),
  );
  const buildings = await fetchAll(client, "buildings", "id,name,address");
  const matchVenue = buildVenueMatcher(venues, buildings);
  const { dishes, dishImages, unmatchedStalls, matchedStallCount } = buildCatalogRows(dishRows, matchVenue, {
    approveLicensedGrabMedia: args.approveLicensedGrabMedia,
  });

  const summary = {
    mode: args.apply ? "apply" : "dry-run",
    source_grab_stalls: grabStalls.length,
    source_dish_rows: dishRows.length,
    source_nonblank_image_refs: dishRows.filter((row) => row.rawImageUrl).length,
    source_real_huawei_images: dishRows.filter((row) => row.imageUrl).length,
    matched_stalls: matchedStallCount,
    unmatched_stalls: unmatchedStalls.length,
    upsert_dishes: dishes.length,
    upsert_dish_images: dishImages.length,
    distinct_image_urls: new Set(dishImages.map((row) => row.url)).size,
    approved_for_display: args.approveLicensedGrabMedia,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (unmatchedStalls.length > 0) {
    console.log(JSON.stringify({ unmatched_stall_sample: unmatchedStalls.slice(0, 10) }, null, 2));
  }

  if (!args.apply) return;
  await upsertBatches(client, "dishes", dishes, "id");
  await upsertBatches(client, "dish_images", dishImages, "dish_id,sort_order");
  console.log(JSON.stringify({ applied: true, dishes: dishes.length, dish_images: dishImages.length }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
