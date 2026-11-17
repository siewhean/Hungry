import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-project-env.mjs";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { createRequire } from "module";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRateLimitedExecutor, clampWorkerCount, mergeCheckpointProgress, runWorkerPool } from "./lib/enrichment-concurrency.mjs";
import { scrapeWithPlatformAdapter, PLATFORM_ADAPTERS } from "./lib/platform-scrapers.mjs";
import { resolveDirectPlatformUrl } from "./lib/platform-resolvers.mjs";
import { scoreVenueIdentity } from "./lib/venue-identity.mjs";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const { imageSize } = require("image-size");

loadProjectEnv();

const supabaseUrl = process.env.HUNGRY_SUPABASE_IMPORT_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or service role key for menu enrichment.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_LIMIT = 50;
const DEFAULT_FETCH_LIMIT = 5000;
const MIN_VALID_MENU_PRICE = 0.05;
const DEFAULT_MIN_IMAGE_DIMENSION = 512;
const MIN_CANDIDATE_GROUP_SCAN_LIMIT = 25;
const SCRAPE_EVALUATION_TIMEOUT_MS = 90_000;
const PAGINATED_FETCH_PAGE_SIZE = 200;
const DEFAULT_BATCH_WRITE_SIZE = 75;
const DEFAULT_CHECKPOINT_PATH = "data/enrichment_checkpoint.json";
const DEFAULT_WORKERS = 2;
const DEFAULT_WRITE_INTERVAL_MS = 250;
const DEFAULT_INTER_VENUE_DELAY_MS = 750;

function parseArgs(argv) {
    const options = {
        dryRun: false,
        fetchLimit: DEFAULT_FETCH_LIMIT,
        headless: true,
        knownSourcesOnly: true,
        allowWeakVenueMatch: false,
        skipDebugCaptures: false,
        limit: DEFAULT_LIMIT,
        exportJsonPath: null,
        maxWriteTimeouts: 3,
        batchWriteSize: DEFAULT_BATCH_WRITE_SIZE,
        checkpointPath: DEFAULT_CHECKPOINT_PATH,
        resetCheckpoint: false,
        minImageDimension: DEFAULT_MIN_IMAGE_DIMENSION,
        offlineWorkbook: null,
        skipVenueIds: new Set(),
        skipVenueNames: new Set(),
        sourceUrl: null,
        venueId: null,
        allowInserts: true,
        workers: DEFAULT_WORKERS,
        writeIntervalMs: DEFAULT_WRITE_INTERVAL_MS,
        interVenueDelayMs: DEFAULT_INTER_VENUE_DELAY_MS,
    };
    for (const arg of argv) {
        if (arg === "--dry-run") options.dryRun = true;
        else if (arg === "--headed") options.headless = false;
        else if (arg === "--skip-debug-captures") options.skipDebugCaptures = true;
        else if (arg === "--known-sources-only") options.knownSourcesOnly = true;
        else if (arg === "--discover-sources") options.knownSourcesOnly = false;
        else if (arg === "--allow-weak-venue-match") options.allowWeakVenueMatch = true;
        else if (arg.startsWith("--export-json=")) options.exportJsonPath = arg.split("=")[1] || null;
        else if (arg.startsWith("--fetch-limit=")) {
            const value = Number(arg.split("=")[1]);
            if (!Number.isInteger(value) || value < 1) throw new Error("--fetch-limit must be a positive integer");
            options.fetchLimit = value;
        }
        else if (arg.startsWith("--limit=")) {
            const value = Number(arg.split("=")[1]);
            if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer");
            options.limit = value;
        }
        else if (arg.startsWith("--max-write-timeouts=")) options.maxWriteTimeouts = Number(arg.split("=")[1]) || 3;
        else if (arg.startsWith("--batch-write-size=")) options.batchWriteSize = Number(arg.split("=")[1]) || DEFAULT_BATCH_WRITE_SIZE;
        else if (arg.startsWith("--checkpoint=")) options.checkpointPath = arg.split("=")[1] || DEFAULT_CHECKPOINT_PATH;
        else if (arg === "--no-checkpoint") options.checkpointPath = null;
        else if (arg === "--reset-checkpoint") options.resetCheckpoint = true;
        else if (arg === "--no-inserts") options.allowInserts = false;
        else if (arg.startsWith("--workers=")) options.workers = clampWorkerCount(arg.split("=")[1], DEFAULT_WORKERS);
        else if (arg.startsWith("--write-interval-ms=")) options.writeIntervalMs = Math.max(0, Number(arg.split("=")[1]) || 0);
        else if (arg.startsWith("--inter-venue-delay-ms=")) options.interVenueDelayMs = Math.max(0, Number(arg.split("=")[1]) || 0);
        else if (arg.startsWith("--min-image-dimension=")) options.minImageDimension = Number(arg.split("=")[1]) || 0;
        else if (arg.startsWith("--offline-workbook=")) options.offlineWorkbook = arg.split("=")[1] || null;
        else if (arg.startsWith("--source-url=")) options.sourceUrl = arg.split("=")[1] || null;
        else if (arg.startsWith("--skip-venue-ids=")) {
            options.skipVenueIds = new Set(
                (arg.split("=")[1] || "")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
            );
        }
        else if (arg.startsWith("--skip-venue-names=")) {
            options.skipVenueNames = new Set(
                (arg.split("=")[1] || "")
                    .split(",")
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean),
            );
        }
        else if (arg.startsWith("--venue-id=")) options.venueId = arg.split("=")[1] || null;
    }
    return options;
}

const runOptions = parseArgs(process.argv.slice(2));
const allowWeakVenueMatch = Boolean(runOptions.allowWeakVenueMatch);
let consecutiveWriteTimeouts = 0;
const exportedRows = [];
const QUERY_TIMEOUT_MS = 180_000;
const venueRunContext = new AsyncLocalStorage();
const scheduleWrite = createRateLimitedExecutor({ minIntervalMs: runOptions.writeIntervalMs });
let checkpointWriteQueue = Promise.resolve();
const checkpointState = {
    scopeKey: null,
    completedVenueIds: new Set(),
    lastProcessedIndex: -1,
};

function markCurrentVenueWriteError() {
    const state = venueRunContext.getStore();
    if (state) state.writeError = true;
}

function currentVenueWriteSucceeded() {
    return venueRunContext.getStore()?.writeError !== true;
}

function markCurrentVenueScrapeFailure() {
    const state = venueRunContext.getStore();
    if (state) state.scrapeFailure = true;
}

function currentVenueCompleted(success) {
    const state = venueRunContext.getStore();
    return currentVenueWriteSucceeded() && (Number(success) > 0 || state?.scrapeFailure !== true);
}

function withSupabaseTimeout(operation, label, timeoutMs = QUERY_TIMEOUT_MS) {
    return Promise.race([
        operation,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Supabase query timeout (${label}) after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs),
        ),
    ]);
}

async function runWithTimeout(operation, label, timeoutMs = SCRAPE_EVALUATION_TIMEOUT_MS) {
    try {
        return await Promise.race([
            operation(),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Scrape timeout (${label}) after ${Math.round(timeoutMs / 1000)}s`)),
                    timeoutMs,
                ),
            ),
        ]);
    } catch (error) {
        console.log(`    [!] ${label} timed out: ${error?.message || error}`);
        return null;
    }
}

function normalize(str) {
  return (str || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function stripMenuItemCodePrefix(value) {
    let name = cleanText(value);
    for (let i = 0; i < 3; i += 1) {
        const next = name
            .replace(/^\(?\s*[a-z]{1,4}[\s-]*[a-z]?\d{1,4}[a-z]?\s*[\).:-]\s*/i, "")
            .replace(/^\(?\s*\d{1,4}[a-z]?\s*[\).:-]\s*/i, "")
            .trim();
        if (next === name) break;
        name = next;
    }
    return name || cleanText(value);
}

function normalizeDishNameForMatch(value) {
    return normalize(stripMenuItemCodePrefix(value));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function venueNameTokens(name) {
    return cleanText(name)
        .toLowerCase()
        .replace(/&/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3)
        .filter(
            (token) =>
                ![
                    "pte",
                    "ltd",
                    "llp",
                    "the",
                    "and",
                    "restaurant",
                    "cafe",
                    "stall",
                    "coffeeshop",
                    "live",
                    "food",
                    "foods",
                    "cuisine",
                    "dessert",
                    "bakery",
                    "seafood",
                    "drinks",
                    "beverages",
                    "snacks",
                    "korean",
                    "japanese",
                    "chinese",
                    "thai",
                    "western",
                    "indian",
                    "malay",
                    "muslim",
                    "halal",
                    "vegetarian",
                ].includes(token),
        );
}

function outletQualifierTokens(venue) {
    const name = cleanText(venue?.name || "");
    const parentheticalTokens = Array.from(name.matchAll(/\(([^)]+)\)/g))
        .flatMap((match) => venueNameTokens(match[1]));
    return Array.from(new Set(parentheticalTokens));
}

function hasVenueNameOverlap(venueName, candidateText) {
    const tokens = venueNameTokens(venueName);
    if (tokens.length === 0) return false;
    const normalizedCandidate = cleanText(candidateText).toLowerCase();
    const matches = tokens.filter((token) => normalizedCandidate.includes(token));
    if (tokens.length === 1) return matches.length === 1;
    return matches.length >= Math.min(2, tokens.length);
}

function hasVenueProperNameOverlap(venueName, candidateText) {
    const weakFoodTokens = new Set([
        "bee",
        "beef",
        "chicken",
        "economy",
        "economic",
        "fish",
        "fried",
        "ho",
        "hor",
        "laksa",
        "lemak",
        "mee",
        "nasi",
        "noodle",
        "prawn",
        "rice",
        "soup",
        "wok",
    ]);
    const tokens = venueNameTokens(venueName).filter((token) => !weakFoodTokens.has(token));
    if (tokens.length === 0) return false;
    const normalizedCandidate = cleanText(candidateText).toLowerCase();
    return tokens.some((token) => normalizedCandidate.includes(token));
}

function fixMojibake(value) {
    return String(value || "")
        .replace(/Ã©/g, "é")
        .replace(/Ã¨/g, "è")
        .replace(/Ãª/g, "ê")
        .replace(/Ã«/g, "ë")
        .replace(/Ã¡/g, "á")
        .replace(/Ã /g, "à")
        .replace(/Ã¢/g, "â")
        .replace(/Ã¤/g, "ä")
        .replace(/Ã¶/g, "ö")
        .replace(/Ã´/g, "ô")
        .replace(/Ã¼/g, "ü")
        .replace(/Ã¹/g, "ù")
        .replace(/Ã»/g, "û")
        .replace(/Ã§/g, "ç")
        .replace(/Ã±/g, "ñ")
        .replace(/â€™/g, "'")
        .replace(/â€œ|â€�/g, "\"")
        .replace(/â€“|â€”/g, "-");
}

function cleanText(value) {
    return fixMojibake(value).replace(/\s+/g, " ").trim();
}

function dishNameTokens(name) {
    return stripMenuItemCodePrefix(name)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2)
        .filter((token) => !["pc", "pcs", "set", "with", "and", "the"].includes(token));
}

function isSafeFuzzyDishMatch(existingName, sourceName) {
    const existingNorm = normalize(existingName);
    const sourceNorm = normalize(sourceName);
    if (!existingNorm || !sourceNorm || existingNorm === sourceNorm) return false;
    if (!existingNorm.includes(sourceNorm) && !sourceNorm.includes(existingNorm)) return false;

    const existingTokens = new Set(dishNameTokens(existingName));
    const sourceTokens = new Set(dishNameTokens(sourceName));
    if (existingTokens.size < 2 || sourceTokens.size < 2) return false;

    const shorter = existingTokens.size <= sourceTokens.size ? existingTokens : sourceTokens;
    const longer = existingTokens.size <= sourceTokens.size ? sourceTokens : existingTokens;
    const shared = Array.from(shorter).filter((token) => longer.has(token));
    return shared.length === shorter.size && shared.length >= 2;
}

function decodeBasicHtmlEntities(value) {
    return String(value || "")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function htmlToText(value) {
    return cleanText(
        decodeBasicHtmlEntities(value)
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<\/(?:p|div|li|h\d)>/gi, " ")
            .replace(/<[^>]+>/g, " "),
    );
}

function parsePrice(value) {
    const match = String(value || "").match(/(?:S\$|\$)?\s*(\d+(?:\.\d{1,2})?)/i);
    if (!match) return null;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatSgd(value) {
    const parsed = typeof value === "number" ? value : parsePrice(value);
    return Number.isFinite(parsed) ? `S$${parsed.toFixed(2)}` : null;
}

function isValidMenuPrice(value) {
    return Number.isFinite(value) && value > MIN_VALID_MENU_PRICE;
}

function isPriceOnlyText(value) {
    const text = cleanText(value);
    if (!text) return false;
    const withoutCurrency = text
        .replace(/s\$/gi, "")
        .replace(/\$/g, "")
        .replace(/\bsgd\b/gi, "")
        .replace(/[|\s,.:()\-–—]+/g, "");
    return /^\d+$/.test(withoutCurrency) && parsePrice(text) !== null;
}

function stripDescriptionBoilerplate(description, price) {
    let text = cleanText(description);
    if (!text) return null;

    text = text
        .replace(/this item contains alcohol\.?\s*/gi, "")
        .replace(/to order it,?\s*please use the grab app\.?\s*/gi, "")
        .replace(/\bopen app\b/gi, "")
        .replace(/\bback to (?:soupermarket|e-?store|shop|menu)\b\.?\s*/gi, "")
        .replace(/\s*\|\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const parsedItemPrice = parsePrice(price);
    if (Number.isFinite(parsedItemPrice)) {
        const escapedPrice = parsedItemPrice.toFixed(2).replace(".", "\\.");
        text = text
            .replace(new RegExp(`\\bsave\\s+\\d+\\s+${escapedPrice}\\s+\\d+(?:\\.\\d{1,2})?\\s*$`, "i"), "")
            .replace(new RegExp(`\\bsave\\s+\\d+\\s+${String(parsedItemPrice).replace(".", "\\.")}\\s+\\d+(?:\\.\\d{1,2})?\\s*$`, "i"), "")
            .replace(new RegExp(`(?:S\\$|\\$)?\\s*${escapedPrice}\\s*$`, "i"), "")
            .replace(new RegExp(`(?:S\\$|\\$)?\\s*${String(parsedItemPrice).replace(".", "\\.")}\\s*$`, "i"), "")
            .trim();
    }

    return text || null;
}

function isUsefulDescription(description, name, price) {
    const text = stripDescriptionBoilerplate(description, price);
    if (!text) return false;
    if (text.length <= 5) return false;
    if (isPriceOnlyText(text)) return false;

    const normalizedText = normalize(text);
    if (!normalizedText) return false;
    if (normalizedText === normalize(name)) return false;

    const parsedDescriptionPrice = parsePrice(text);
    const parsedItemPrice = parsePrice(price);
    if (
        Number.isFinite(parsedDescriptionPrice) &&
        Number.isFinite(parsedItemPrice) &&
        Math.abs(parsedDescriptionPrice - parsedItemPrice) < 0.001 &&
        text.replace(/(?:S\$|\$)?\s*\d+(?:\.\d{1,2})?/gi, "").replace(/[|\s,.:()\-–—]+/g, "") === ""
    ) {
        return false;
    }

    return true;
}

function extractSingaporePostalCode(value) {
    const match = cleanText(value).match(/\b(\d{6})\b/);
    return match?.[1] || null;
}

function isGenericVenueAddressText(value) {
    const text = cleanText(value).toLowerCase();
    if (!text) return true;
    return (
      text === "singapore" ||
      text === "sg" ||
      text === "singapore." ||
      /^(singapore|sg)\s*$/i.test(text) ||
      !/[a-z]/i.test(text) ||
      text.length <= 4
    );
}

function urlLocationTokens(sourceUrl, venue) {
    try {
        const url = new URL(sourceUrl);
        const nameTokens = new Set(venueNameTokens(venue?.name || ""));
        const restaurantSlug = url.pathname
            .toLowerCase()
            .split("/")
            .find((part) => part.includes("-delivery")) || url.pathname.toLowerCase();
        return restaurantSlug
            .replace(/-delivery.*$/, "")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length >= 3 || /^\d{1,4}$/.test(token))
            .filter(
                (token) =>
                    !nameTokens.has(token) &&
                    ![
                        "https",
                        "food",
                        "grab",
                        "com",
                        "restaurant",
                        "delivery",
                        "oddle",
                        "singapore",
                        "road",
                        "street",
                        "lane",
                        "avenue",
                        "drive",
                        "central",
                        "centre",
                        "center",
                        "mall",
                        "shopping",
                        "plaza",
                    ].includes(token),
            );
    } catch {
        return [];
    }
}

function addressMatchesSourceUrl(sourceUrl, venue, address) {
    const tokens = urlLocationTokens(sourceUrl, venue);
    if (tokens.length === 0) return true;
    const normalizedAddress = cleanText(address).toLowerCase();
    const textTokens = tokens.filter((token) => !/^\d+$/.test(token));
    const numberTokens = tokens.filter((token) => /^\d+$/.test(token));
    const hasTextMatch = textTokens.length === 0 || textTokens.some((token) => normalizedAddress.includes(token));
    const hasNumberMatch =
        numberTokens.length === 0 ||
        numberTokens.every((token) => new RegExp(`\\b${token}\\b`).test(normalizedAddress));
    return hasTextMatch && hasNumberMatch;
}

function existingVenueAddressMatchesSourceUrl(sourceUrl, venue) {
    if (!venue?.address || cleanText(venue.address).length < 5) return true;
    const addressWithPostal = cleanText(`${venue.address || ""} ${venue.postal_code || ""}`);
    return addressMatchesSourceUrl(sourceUrl, venue, addressWithPostal);
}

function extractedVenueAddressMatchesExisting(venueInfo, venue) {
    const extracted = cleanText(venueInfo?.addr || "");
    const existing = cleanText(`${venue?.address || ""} ${venue?.postal_code || ""}`);
    if (!extracted || isGenericVenueAddressText(extracted) || !existing) return false;

    const sourcePostal = extractSingaporePostalCode(extracted);
    const venuePostal = cleanText(venue?.postal_code || "");
    if (sourcePostal && venuePostal && sourcePostal === venuePostal) return true;

    const extractedTokens = new Set(
        extracted
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length >= 3 || /^\d{1,4}$/.test(token)),
    );
    const existingTokens = new Set(
        existing
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length >= 3 || /^\d{1,4}$/.test(token)),
    );
    const shared = Array.from(extractedTokens).filter((token) => existingTokens.has(token));
    return shared.length >= 2;
}

function isUsableImageUrl(value) {
    const url = cleanText(value);
    if (!/^https?:\/\//i.test(url) || url.includes(",")) return false;
    const lowered = url.toLowerCase();
    return ![
        "plus-white",
        "quick-add",
        "logo-app-grab",
        "placeholder",
        "default",
        "transparent",
        "1x1",
        "logo-app-grab",
        "_thumb",
        "_s_",
    ].some((marker) => lowered.includes(marker));
}

function isOfficialImageUrl(value, source) {
    const url = cleanText(value);
    if (!isUsableImageUrl(url)) return false;
    let host = "";
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return false;
    }

    const lowered = url.toLowerCase();
    if (
        lowered.includes("/w_100/") ||
        lowered.includes("/w_120/") ||
        lowered.includes("/h_100/") ||
        /_[0-9]{2,3}x[0-9]{2,3}\./.test(lowered) ||
        /[?&](?:w|h)=\d{2,3}\b/.test(lowered) ||
        /\/(?:tiny|small|thumb|thumbnail|icon)\//.test(lowered)
    ) {
        return false;
    }

    if (source === "grabfood") {
        return host.includes("huawei-food-cms.grab.com") || host.includes("food.grab.com");
    }
    if (source === "oddle") {
        return host.includes("oddle") || host.includes("alicdn") || host.includes("gravatar") || host.includes("cloudfront") || host.includes("imgix.net");
    }
    if (source === "foodpanda") {
        return host.endsWith("deliveryhero.io") || host.endsWith("foodpanda.com") || host.endsWith("foodpanda.sg");
    }
    if (source === "deliveroo") {
        return host.endsWith("roocdn.com") || host.endsWith("deliveroo.net") || host.endsWith("deliveroo.com.sg");
    }
    if (source === "getz") {
        return host.includes("getz-prod") ||
            host.includes("getz-online-store") ||
            (host.includes("s3-ap-southeast-1.amazonaws.com") && lowered.includes("/getz-prod/"));
    }
    if (source?.startsWith("official:")) {
        const officialHost = source.slice("official:".length);
        return (
            host === officialHost ||
            host.endsWith(`.${officialHost}`) ||
            (host === "cdn.shopify.com" && lowered.includes("/products/")) ||
            (host.endsWith(".myshopify.com") && lowered.includes("/products/"))
        );
    }

    return false;
}

function normalizeVenueImageUrl(value, source) {
    const candidate = cleanText(value);
    if (!candidate) return null;
    return isOfficialImageUrl(candidate, source) ? candidate : null;
}

function mediaRightsStatusForSource(source) {
    if (source === "grabfood") return "permitted_api";
    if (source === "foodpanda" || source === "deliveroo") return "unverified";
    return "operator_owned";
}

function sourceHasApprovedRights(source) {
    return ["merchant_owned", "operator_owned", "permitted_api", "licensed"]
        .includes(mediaRightsStatusForSource(source));
}

const imageDimensionCache = new Map();

async function getImageDimensions(url) {
    const cleanUrl = cleanText(url);
    if (!isUsableImageUrl(cleanUrl)) return null;
    if (imageDimensionCache.has(cleanUrl)) return imageDimensionCache.get(cleanUrl);
    try {
        const response = await fetch(cleanUrl, { signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const dimensions = imageSize(Buffer.from(arrayBuffer));
        const result =
            Number.isFinite(dimensions?.width) && Number.isFinite(dimensions?.height)
                ? { width: dimensions.width, height: dimensions.height }
                : null;
        imageDimensionCache.set(cleanUrl, result);
        return result;
    } catch (error) {
        console.log(`      [-] Could not inspect image dimensions: ${cleanUrl.slice(0, 96)} (${error.message})`);
        imageDimensionCache.set(cleanUrl, null);
        return null;
    }
}

async function getApprovedOfficialImageUrl(url, source, itemName) {
    const cleanUrl = cleanText(url);
    if (!sourceHasApprovedRights(source)) return null;
    if (!isOfficialImageUrl(cleanUrl, source)) return null;
    if (runOptions.minImageDimension <= 0) return cleanUrl;
    const dimensions = await getImageDimensions(cleanUrl);
    const shortestSide = Math.min(dimensions?.width || 0, dimensions?.height || 0);
    if (shortestSide < runOptions.minImageDimension) {
        console.log(
            `      [i] Accepting official image below HD threshold for ${itemName}: ${dimensions?.width || "?"}x${dimensions?.height || "?"}`,
        );
    }
    return cleanUrl;
}

function isLikelyVenueLogoUrl(value, source = null) {
    if (!isUsableImageUrl(value)) return false;
    const lowered = value.toLowerCase();
    // Grab exposes merchant hero/menu media through the same CDN. Without a
    // trusted logo-specific field, treating any Grab image as a logo is unsafe.
    if (source === "grabfood") return false;
    return ![
        "/hero/",
        "social-hero",
        "grabfood-logo",
        "logo-grab",
        "logo_app_grab",
        "logo-app-grab",
        "merchant-default",
        "placeholder",
    ].some((marker) => lowered.includes(marker));
}

function isLikelyMenuOptionName(value) {
    const name = cleanText(value);
    const lowered = name.toLowerCase();
    return (
        /^\(\s*\d+\s*[\)）]/.test(name) ||
        /^\+\s*\d+\b/.test(name) ||
        /^g\d+\b.*\bsauce\b/i.test(name) ||
        /^(?:cutler(?:y|ies)|utensils?|napkins?|delivery service)\b/i.test(name) ||
        /\b(?:bio\s+)?(?:forks?|spoons?|plates?|bowls?|serviettes?|napkins?|utensils?|cutler(?:y|ies))\b/i.test(name) ||
        /\bextra\s+gravy\s+only\b/i.test(lowered) ||
        /\bdoggy\s+biscuits?\b/i.test(lowered)
    );
}

function findStringsByKey(value, keyPattern, results = []) {
    if (!value || typeof value !== "object" || results.length > 25) return results;
    if (Array.isArray(value)) {
        value.forEach((item) => findStringsByKey(item, keyPattern, results));
        return results;
    }
    for (const [key, nested] of Object.entries(value)) {
        if (typeof nested === "string" && keyPattern.test(key) && cleanText(nested)) {
            results.push(cleanText(nested));
        } else if (nested && typeof nested === "object") {
            findStringsByKey(nested, keyPattern, results);
        }
    }
    return results;
}

function extractVenueInfoFromNextData(nextData) {
    if (!nextData) return { logo: null, addr: null };
    try {
        const parsed = JSON.parse(nextData);
        const addresses = findStringsByKey(parsed, /^(address|fullAddress|displayAddress|merchantAddress)$/i);
        const logos = findStringsByKey(parsed, /(logo|merchantLogo|brandLogo|photoHref|imageUrl|coverImage)/i);
        const addr = addresses.find((candidate) =>
            /singapore|sg\b|\d{6}|#\d|street|road|avenue|central|mall|plaza|centre|center/i.test(candidate),
        ) || null;
        const logo = logos.find((candidate) => isLikelyVenueLogoUrl(candidate, "grabfood")) || null;
        return { logo, addr };
    } catch {
        return { logo: null, addr: null };
    }
}

function buildVenueUpdates(venueInfo, venue, sourceUrl, source) {
    const updates = {};
    const sourceRightsApproved = sourceHasApprovedRights(source);
    const existingAddress = cleanText(venue.address || "");
    const hasWeakExistingAddress =
        !existingAddress || existingAddress.length < 5 || isGenericVenueAddressText(existingAddress);
    const existingVenueImage = cleanText(venue.image_url || "");
    const hasWeakExistingVenueImage =
        !existingVenueImage ||
        /unsplash|picsum|placeholder|default/i.test(existingVenueImage);
    if (
        sourceRightsApproved &&
        venueInfo.logo &&
        isOfficialImageUrl(venueInfo.logo, source) &&
        isLikelyVenueLogoUrl(venueInfo.logo, source) &&
        (!venue.logo_url || venue.logo_url.length < 5)
    ) {
        updates.logo_url = venueInfo.logo;
        updates.media_source_url = sourceUrl;
        updates.media_approved_for_display = true;
        updates.media_rights_status = mediaRightsStatusForSource(source);
        if (hasWeakExistingVenueImage) {
            updates.image_url = null;
        }
    } else if (
        sourceRightsApproved &&
        venueInfo.logo &&
        isOfficialImageUrl(venueInfo.logo, source) &&
        !isLikelyVenueLogoUrl(venueInfo.logo, source) &&
        hasWeakExistingVenueImage
    ) {
        updates.image_url = venueInfo.logo;
        updates.media_source_url = sourceUrl;
        updates.media_approved_for_display = true;
        updates.media_rights_status = mediaRightsStatusForSource(source);
    }
    if (
        hasWeakExistingVenueImage &&
        !Object.prototype.hasOwnProperty.call(updates, "image_url") &&
        venue.logo_url &&
        isLikelyVenueLogoUrl(venue.logo_url, source)
    ) {
        updates.image_url = null;
    }
    const addressMatchesSource = venueInfo.addr && addressMatchesSourceUrl(sourceUrl, venue, venueInfo.addr);
    if (venueInfo.addr && !addressMatchesSource) {
        console.log(`    [!] Extracted address does not strongly match source URL location: ${venueInfo.addr}`);
    }
    if (
        venueInfo.addr &&
        !isGenericVenueAddressText(venueInfo.addr) &&
        (hasWeakExistingAddress || addressMatchesSource) &&
        cleanText(venueInfo.addr) !== existingAddress
    ) {
        updates.address = venueInfo.addr.substring(0, 500);
    }
    const postalCode = extractSingaporePostalCode(venueInfo.addr);
    if (
        postalCode &&
        (hasWeakExistingAddress || !venue.postal_code || venue.postal_code === postalCode) &&
        String(venue.postal_code || "") !== String(postalCode)
    ) {
        updates.postal_code = postalCode;
    }
    const existingMenuSource = cleanText(venue.menu_source_url || "");
    const hasWeakExistingMenuSource =
        !existingMenuSource ||
        existingMenuSource.length < 5 ||
        /data\.gov\.sg|sfa\.gov\.sg/i.test(existingMenuSource);
    if (sourceUrl && hasWeakExistingMenuSource) {
        updates.menu_source_url = sourceUrl;
        updates.menu_approved_for_display = sourceRightsApproved;
        updates.menu_rights_status = mediaRightsStatusForSource(source);
    }
    return updates;
}

function hasKnownMenuSource(venue) {
    return /grab\.com|oddle|foodpanda\.sg|deliveroo\.com\.sg|order\.[^.]+|getz/i.test(venue?.menu_source_url || "");
}

function shouldSkipVenue(venue) {
    const id = cleanText(venue?.id || "");
    const name = cleanText(venue?.name || "").toLowerCase();
    const isShortAsciiPlaceholder = /^[a-z]{1,2}$/.test(name);
    const placeholderNames = new Set([
        "n/a",
        "na",
        "nil",
        "non applicable",
        "not applicable",
        "not available",
        "unknown",
    ]);
    return (
        runOptions.skipVenueIds.has(id) ||
        runOptions.skipVenueNames.has(name) ||
        placeholderNames.has(name) ||
        isShortAsciiPlaceholder
    );
}

function checkpointEnabled() {
    return Boolean(runOptions.checkpointPath) && !runOptions.venueId && runOptions.limit > 1;
}

function checkpointScopeKey() {
    return JSON.stringify({
        dryRun: runOptions.dryRun,
        allowInserts: runOptions.allowInserts,
        knownSourcesOnly: runOptions.knownSourcesOnly,
        offlineWorkbook: runOptions.offlineWorkbook || null,
        sourceUrl: runOptions.sourceUrl || null,
        fetchLimit: runOptions.fetchLimit,
        limit: runOptions.limit,
        skipVenueIds: Array.from(runOptions.skipVenueIds).sort(),
        skipVenueNames: Array.from(runOptions.skipVenueNames).sort(),
    });
}

async function loadCheckpoint() {
    if (!checkpointEnabled() || runOptions.resetCheckpoint) return;
    checkpointState.scopeKey = checkpointScopeKey();
    try {
        const raw = await fs.readFile(runOptions.checkpointPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed?.scope_key !== checkpointState.scopeKey) {
            console.log(`  [checkpoint] Ignoring checkpoint with different scope: ${runOptions.checkpointPath}`);
            return;
        }
        checkpointState.lastProcessedIndex = Number(parsed.last_processed_index ?? -1);
        checkpointState.completedVenueIds = new Set(
            Array.isArray(parsed.completed_venue_ids) ? parsed.completed_venue_ids.filter(Boolean) : [],
        );
        console.log(
            `  [checkpoint] Loaded ${checkpointState.completedVenueIds.size} completed venues from ${runOptions.checkpointPath}`,
        );
    } catch (error) {
        if (error?.code !== "ENOENT") {
            console.log(`  [checkpoint] Could not read ${runOptions.checkpointPath}: ${error.message}`);
        }
    }
}

async function saveCheckpoint(index, venue, success, completed = true) {
    if (!checkpointEnabled()) return;
    const operation = checkpointWriteQueue.then(async () => {
        checkpointState.scopeKey ||= checkpointScopeKey();
        const progress = mergeCheckpointProgress(checkpointState, {
            index,
            venue,
            success,
            completed,
        });
        const checkpoint = {
            updated_at: new Date().toISOString(),
            scope_key: checkpointState.scopeKey,
            dry_run: runOptions.dryRun,
            ...progress,
        };
        await fs.mkdir(path.dirname(runOptions.checkpointPath), { recursive: true });
        const temporaryPath = `${runOptions.checkpointPath}.tmp`;
        await fs.writeFile(temporaryPath, JSON.stringify(checkpoint, null, 2));
        await fs.rename(temporaryPath, runOptions.checkpointPath);
        console.log(
            `  [checkpoint] Saved ${completed ? "completed" : "incomplete"} progress after ${venue?.name || venue?.id || `index ${index}`}`,
        );
    });
    checkpointWriteQueue = operation.catch(() => undefined);
    return operation;
}

async function runWithRetry(operation, label, retries = 2) {
    let attempt = 0;
    while (true) {
        attempt += 1;
        let result;
        try {
            result = await Promise.race([
                operation(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Supabase write timeout (${label}) after ${Math.round(QUERY_TIMEOUT_MS / 1000)}s`)),
                        QUERY_TIMEOUT_MS,
                    ),
                ),
            ]);
        } catch (error) {
            result = { error: { message: String(error?.message || error) } };
        }
        if (!result?.error) {
            trackWriteResult(result, `${label} [attempt:${attempt}]`);
            return result;
        }

        const isTimeout = /statement timeout|connection timeout|canceling statement/i.test(result.error.message || "");
        if (!isTimeout || attempt > retries) {
            trackWriteResult(result, `${label} [attempt:${attempt}]`);
            return result;
        }

        const delayMs = 500 * Math.pow(2, attempt);
        console.log(`    [!] Write timeout for ${label}, retrying in ${delayMs}ms (attempt ${attempt}/${retries})`);
        trackWriteResult(result, `${label} [attempt:${attempt}]`);
        await sleep(delayMs);
    }
}

async function applyUpdate(table, updates, id) {
    if (Object.keys(updates).length === 0) return { skipped: true };
    if (runOptions.dryRun) return { dryRun: true };
    const result = await scheduleWrite(() => runWithRetry(
        () => supabase.from(table).update(updates).eq("id", id),
        `${table}:${id}`,
        runOptions.maxWriteTimeouts,
    ));
    if (result?.error) markCurrentVenueWriteError();
    return result;
}

async function applyInsert(table, row) {
    if (runOptions.dryRun) return { dryRun: true };
    const result = await scheduleWrite(() => runWithRetry(
        () => supabase.from(table).insert(row),
        `${table}:${row?.id || "insert"}`,
        runOptions.maxWriteTimeouts,
    ));
    if (result?.error) markCurrentVenueWriteError();
    return result;
}

function chunkRows(rows, chunkSize) {
    const size = Math.max(1, Number(chunkSize) || DEFAULT_BATCH_WRITE_SIZE);
    const chunks = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

async function applyBatchUpsert(table, rows, label) {
    if (!rows.length) return { count: 0 };
    if (runOptions.dryRun) return { dryRun: true, count: rows.length };

    let count = 0;
    for (const [index, chunk] of chunkRows(rows, runOptions.batchWriteSize).entries()) {
        const chunkLabel = `${table}:${label}:chunk-${index + 1}`;
        const result = await scheduleWrite(() => runWithRetry(
            () => supabase.from(table).upsert(chunk, { onConflict: "id" }),
            chunkLabel,
            runOptions.maxWriteTimeouts,
        ));
        if (result?.error) {
            markCurrentVenueWriteError();
            return { ...result, count };
        }
        count += chunk.length;
    }
    return { count };
}

async function applyBatchUpdate(table, rows, label) {
    if (!rows.length) return { count: 0 };
    if (runOptions.dryRun) return { dryRun: true, count: rows.length };

    let count = 0;
    for (const row of rows) {
        const { id, ...updates } = row;
        const result = await applyUpdate(table, updates, id);
        if (result?.error) return { ...result, count };
        count += 1;
    }
    return { count };
}

function trackWriteResult(result, label) {
    if (!result?.error) {
        consecutiveWriteTimeouts = 0;
        return;
    }
    if (!/statement timeout|connection timeout|canceling statement/i.test(result.error.message || "")) {
        return;
    }
    consecutiveWriteTimeouts += 1;
    console.log(
        `      [!] Write timeout at ${label}: ${result.error.message} (consecutive=${consecutiveWriteTimeouts})`,
    );
}

async function fetchVenueDishNameSet(venueId) {
    const { data, error } = await safeWithTimeout(
        supabase.from("dishes").select("id,name").eq("venue_id", venueId).limit(runOptions.fetchLimit),
        `fetchVenueDishNameSet:${venueId}`,
        90_000,
    );
    if (error) {
        console.log(`  [!] Skipping dish-name prefetch for ${venueId}: ${error.message}`);
        return new Set();
    }
    return new Set((data ?? []).map((dish) => normalize(dish.name)).filter(Boolean));
}

async function safeWithTimeout(operation, label, timeoutMs = QUERY_TIMEOUT_MS) {
    try {
        return await withSupabaseTimeout(operation, label, timeoutMs);
    } catch (error) {
        return { error: { message: String(error?.message || error) } };
    }
}

async function resolvePlatformSourceUrl(page, venue, platform) {
    try {
        const direct = await resolveDirectPlatformUrl(page, { platform, venue });
        if (direct.url) return direct.url;
    } catch (error) {
        markCurrentVenueScrapeFailure();
        console.log(`    [i] ${platform} direct resolver unavailable: ${error.message}`);
    }
    return null;
}

async function validateVenuePage(page, venue, url, source, venueInfo = {}) {
    const pageIdentity = await page.evaluate(() => {
        const primaryHeadings = Array.from(document.querySelectorAll("h1"))
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .slice(0, 3);
        const fallbackHeadings = primaryHeadings.length
            ? []
            : Array.from(document.querySelectorAll("h2"))
                .map((el) => el.textContent?.trim())
                .filter(Boolean)
                .slice(0, 2);
        const headings = [...primaryHeadings, ...fallbackHeadings]
            .join(" ");
        return `${document.title || ""} ${headings}`;
    });
    const assessment = scoreVenueIdentity({
        venue,
        candidate: { name: pageIdentity, address: venueInfo.addr, url },
    });
    console.log(
        `    [identity] ${source} score=${assessment.score.toFixed(2)} band=${assessment.band}` +
        `${assessment.hardReasons.length ? ` reasons=${assessment.hardReasons.join(",")}` : ""}`,
    );
    if (assessment.band === "accept") return true;
    const storedSourceUrlMatches = cleanText(venue.menu_source_url || "") === cleanText(url || "");
    if (
        assessment.band === "review" &&
        allowWeakVenueMatch &&
        storedSourceUrlMatches &&
        !assessment.hardReasons.includes("postal_mismatch") &&
        !assessment.hardReasons.includes("outlet_qualifier_mismatch")
    ) {
        console.log(`    [!] ${source} identity is review-band; proceeding only because weak-match mode was explicit.`);
        return true;
    }
    console.log(`    [!] ${source} page was not accepted for "${venue.name}". Page identity: ${pageIdentity.slice(0, 160)}`);
    return false;
}

async function capturePlatformDebug(page, adapter, venue) {
    if (runOptions.skipDebugCaptures || adapter.source !== "grabfood") return;
    try {
        await fs.mkdir("scratch", { recursive: true });
        const safeVenueId = cleanText(venue?.id || venue?.name || "venue").replace(/[^a-z0-9_-]+/gi, "_");
        await page.screenshot({ path: `scratch/${adapter.source}_${safeVenueId}.png`, timeout: 15_000 });
        await fs.writeFile(`scratch/${adapter.source}_${safeVenueId}.html`, await page.content());
    } catch (error) {
        console.log(`    [!] Skipping optional ${adapter.label} debug capture: ${error.message}`);
    }
}

async function scrapePlatform(page, platform, url, missingDishes, venue) {
    return scrapeWithPlatformAdapter({
        page,
        platform,
        url,
        venue,
        missingDishes,
        runWithTimeout,
        validateVenue: validateVenuePage,
        buildVenueUpdates,
        applyVenueUpdate: (updates, venueId) => applyUpdate("venues", updates, venueId),
        matchDishes: processMatches,
        normalize,
        debugCapture: (debugPage, adapter) => capturePlatformDebug(debugPage, adapter, venue),
        onTransientFailure: markCurrentVenueScrapeFailure,
    });
}

async function scrapeGrab(page, url, missingDishes, venue) {
    return scrapePlatform(page, "grabfood", url, missingDishes, venue);
}

async function scrapeOddle(page, url, missingDishes, venue) {
    return scrapePlatform(page, "oddle", url, missingDishes, venue);
}

async function scrapeFoodpanda(page, url, missingDishes, venue) {
    return scrapePlatform(page, "foodpanda", url, missingDishes, venue);
}

async function scrapeDeliveroo(page, url, missingDishes, venue) {
    return scrapePlatform(page, "deliveroo", url, missingDishes, venue);
}

async function scrapeGetz(page, url, missingDishes, venue) {
    console.log(`  Scraping Getz official menu: ${url}`);
    try {
        const firstUrl = url.includes("templateType=")
            ? url
            : `${url}${url.includes("?") ? "&" : "?"}templateType=false`;
        await page.goto(firstUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(2_000);

        const venueInfo = await page.evaluate(() => {
            const logo =
                document.querySelector(".navbar-brand img")?.getAttribute("src") ||
                document.querySelector("img[src*='HUGGS_LOGO'], img[src*='logo'], img[src*='LOGO']")?.getAttribute("src") ||
                null;
            const brandName = document.querySelector(".brand-name")?.textContent?.trim() || "";
            return {
                logo: logo ? new URL(logo, location.href).href : null,
                addr: null,
                brandName,
            };
        });

        const categoryUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a[href*='/Category/']"));
            return Array.from(
                new Set(
                    links
                        .map((link) => link.getAttribute("href"))
                        .filter(Boolean)
                        .map((href) => new URL(href, location.href).href)
                        .filter((href) => /\/Category\/.+\.html/i.test(href)),
                ),
            );
        });
        const urlsToScrape = Array.from(new Set([firstUrl, ...categoryUrls])).slice(0, 30);
        const getzData = new Map();

        for (const categoryUrl of urlsToScrape) {
            const navigableUrl = categoryUrl.includes("templateType=")
                ? categoryUrl
                : `${categoryUrl}${categoryUrl.includes("?") ? "&" : "?"}templateType=false`;
            await page.goto(navigableUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
            await page.waitForTimeout(800);
            const items = await runWithTimeout(
                () =>
                    page.evaluate(() => {
                        const rows = [];
                        const productNodes = Array.from(document.querySelectorAll("[data-full-height-item], .item-products"));
                        for (const node of productNodes) {
                            const name =
                                node.querySelector(".text-clamp-overflow-item")?.textContent?.trim() ||
                                node.querySelector(".product__title")?.textContent?.trim() ||
                                "";
                            const image = node.querySelector(".product__img img, img.asyncImage, img[data-src]");
                            const src = image?.getAttribute("data-src") || image?.getAttribute("src") || "";
                            const priceText =
                                node.querySelector(".price-bottom--nowrap")?.textContent?.trim() ||
                                node.querySelector(".product__price")?.textContent?.trim() ||
                                "";
                            const desc =
                                node.querySelector(".product__desc-mobile.description")?.textContent?.trim() ||
                                node.querySelector(".description")?.textContent?.trim() ||
                                "";
                            if (name) {
                                rows.push({
                                    name,
                                    price: priceText,
                                    desc,
                                    src: src ? new URL(src, location.href).href : null,
                                });
                            }
                        }
                        return rows;
                    }),
                `Getz extraction for ${navigableUrl}`,
                45_000,
            );
            for (const item of items || []) {
                item.source = "getz";
                item.sourceUrl = navigableUrl;
                const key = normalize(item.name);
                if (key && !getzData.has(key)) getzData.set(key, item);
            }
        }

        if (venueInfo.logo) {
            const updates = buildVenueUpdates(venueInfo, venue, firstUrl, "getz");
            if (Object.keys(updates).length > 0) {
                await applyUpdate("venues", updates, venue.id);
                console.log(`    Updated venue info: logo=${!!updates.logo_url}, image=${!!updates.image_url}`);
            }
        }

        return await processMatches(getzData, missingDishes, venue);
    } catch (e) {
        console.log(`    [!] Getz scrape failed: ${e.message}`);
        return 0;
    }
}

async function scrapeWooCommerce(page, url, missingDishes, venue) {
    console.log(`  Scraping WooCommerce official menu: ${url}`);
    try {
        const sourceUrl = new URL(url);
        const sourceHost = sourceUrl.hostname.toLowerCase();
        const source = `official:${sourceHost}`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(1_000);
        const venueInfo = await page.evaluate(() => {
            const logo =
                document.querySelector("img[class*='logo'], img[src*='logo']")?.getAttribute("src") ||
                document.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href") ||
                null;
            return {
                logo: logo ? new URL(logo, location.href).href : null,
                addr: null,
            };
        });

        const wooData = new Map();
        for (let pageNumber = 1; pageNumber <= 8; pageNumber += 1) {
            const apiUrl = `${sourceUrl.origin}/wp-json/wc/store/v1/products?per_page=100&page=${pageNumber}`;
            const response = await fetch(apiUrl, { signal: AbortSignal.timeout(20_000) });
            if (!response.ok) {
                if (pageNumber === 1) throw new Error(`WooCommerce API HTTP ${response.status}`);
                break;
            }
            const products = await response.json();
            if (!Array.isArray(products) || products.length === 0) break;
            for (const product of products) {
                const name = cleanText(product.name);
                if (!name) continue;
                const image = Array.isArray(product.images) ? product.images[0] : null;
                const imageUrl = cleanText(image?.src || "");
                const priceMinor = Number.parseFloat(product.prices?.price);
                const minorUnit = Number.parseInt(product.prices?.currency_minor_unit ?? "2", 10);
                const divisor = 10 ** (Number.isFinite(minorUnit) ? minorUnit : 2);
                const price = Number.isFinite(priceMinor) ? String(priceMinor / divisor) : null;
                const desc = htmlToText(product.short_description || product.description || "");
                wooData.set(normalize(name), {
                    name,
                    price,
                    desc,
                    src: imageUrl || null,
                    source,
                    sourceUrl: product.permalink || url,
                });
            }
            if (products.length < 100) break;
        }

        if (venueInfo.logo) {
            const updates = buildVenueUpdates(venueInfo, venue, url, source);
            if (Object.keys(updates).length > 0) {
                await applyUpdate("venues", updates, venue.id);
                console.log(`    Updated venue info: logo=${!!updates.logo_url}, image=${Object.prototype.hasOwnProperty.call(updates, "image_url")}`);
            }
        }

        return await processMatches(wooData, missingDishes, venue);
    } catch (e) {
        console.log(`    [!] WooCommerce scrape failed: ${e.message}`);
        return 0;
    }
}

function normalizeShopifyImageUrl(value) {
    const candidate = cleanText(value);
    if (!candidate) return null;
    try {
        const parsed = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate);
        if (!/cdn\.shopify\.com|myshopify\.com/i.test(parsed.hostname)) return parsed.href;
        parsed.searchParams.delete("width");
        parsed.searchParams.delete("height");
        parsed.searchParams.delete("crop");
        return parsed.href;
    } catch {
        return null;
    }
}

async function scrapeShopify(page, url, missingDishes, venue) {
    console.log(`  Scraping Shopify official menu: ${url}`);
    try {
        const sourceUrl = new URL(url);
        const sourceHost = sourceUrl.hostname.toLowerCase().replace(/^www\./, "");
        const source = `official:${sourceHost}`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(1_000);
        const venueInfo = await page.evaluate(() => {
            const absolute = (value) => {
                if (!value) return null;
                try {
                    return new URL(value, location.href).href;
                } catch {
                    return null;
                }
            };
            const jsonLdLogo = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
                .map((node) => {
                    try {
                        const parsed = JSON.parse(node.textContent || "null");
                        const graph = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
                        return graph.find((entry) => entry?.logo)?.logo || null;
                    } catch {
                        return null;
                    }
                })
                .find(Boolean);
            const logo =
                jsonLdLogo ||
                document.querySelector("img[class*='logo'], img[src*='logo']")?.getAttribute("src") ||
                document.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href") ||
                null;
            return {
                logo: absolute(logo),
                addr: null,
            };
        });

        const shopifyData = new Map();
        let nextUrl = `${sourceUrl.origin}/products.json?limit=250`;
        for (let pageNumber = 1; pageNumber <= 8 && nextUrl; pageNumber += 1) {
            const response = await fetch(nextUrl, { signal: AbortSignal.timeout(20_000) });
            if (!response.ok) {
                if (pageNumber === 1) throw new Error(`Shopify products API HTTP ${response.status}`);
                break;
            }
            const payload = await response.json();
            const products = Array.isArray(payload?.products) ? payload.products : [];
            if (products.length === 0) break;
            for (const product of products) {
                const name = cleanText(product.title);
                if (!name) continue;
                const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null;
                const image =
                    Array.isArray(product.images) && product.images.length > 0
                        ? product.images[0]
                        : product.image;
                const imageUrl = normalizeShopifyImageUrl(image?.src || "");
                const desc = htmlToText(product.body_html || "");
                const productUrl = product.handle
                    ? `${sourceUrl.origin}/products/${product.handle}`
                    : url;
                shopifyData.set(normalize(name), {
                    name,
                    price: firstVariant?.price ? String(firstVariant.price) : null,
                    desc,
                    src: imageUrl,
                    source,
                    sourceUrl: productUrl,
                });
            }
            nextUrl = products.length === 250
                ? `${sourceUrl.origin}/products.json?limit=250&page=${pageNumber + 1}`
                : null;
        }

        if (venueInfo.logo) {
            const updates = buildVenueUpdates(venueInfo, venue, url, source);
            if (Object.keys(updates).length > 0) {
                await applyUpdate("venues", updates, venue.id);
                console.log(`    Updated venue info: logo=${!!updates.logo_url}, image=${Object.prototype.hasOwnProperty.call(updates, "image_url")}`);
            }
        }

        return await processMatches(shopifyData, missingDishes, venue);
    } catch (e) {
        console.log(`    [!] Shopify scrape failed: ${e.message}`);
        return 0;
    }
}

async function scrapeWordPressProducts(page, url, missingDishes, venue) {
    console.log(`  Scraping WordPress official products: ${url}`);
    try {
        const sourceUrl = new URL(url);
        const sourceHost = sourceUrl.hostname.toLowerCase();
        const source = `official:${sourceHost}`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(1_000);
        const venueInfo = await page.evaluate(() => {
            const absolute = (value) => {
                if (!value) return null;
                try {
                    return new URL(value, location.href).href;
                } catch {
                    return null;
                }
            };
            const jsonLdLogo = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
                .map((node) => {
                    try {
                        const parsed = JSON.parse(node.textContent || "null");
                        const graph = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
                        return graph.find((entry) => entry?.logo)?.logo || null;
                    } catch {
                        return null;
                    }
                })
                .find(Boolean);
            const logo =
                jsonLdLogo ||
                document.querySelector("img[class*='logo'], img[src*='logo']")?.getAttribute("src") ||
                document.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href") ||
                null;
            return {
                logo: absolute(logo),
                addr: null,
            };
        });

        const wpData = new Map();
        for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
            const apiUrl = `${sourceUrl.origin}/wp-json/wp/v2/product?per_page=100&_embed=1&page=${pageNumber}`;
            const response = await fetch(apiUrl, { signal: AbortSignal.timeout(25_000) });
            if (!response.ok) {
                if (pageNumber === 1) throw new Error(`WordPress products API HTTP ${response.status}`);
                break;
            }
            const products = await response.json();
            if (!Array.isArray(products) || products.length === 0) break;
            for (const product of products) {
                const name = htmlToText(product?.title?.rendered || product?.title || "");
                if (!name) continue;
                const media = Array.isArray(product?._embedded?.["wp:featuredmedia"])
                    ? product._embedded["wp:featuredmedia"][0]
                    : null;
                const imageUrl = cleanText(media?.source_url || "");
                const desc = htmlToText(product?.excerpt?.rendered || product?.content?.rendered || "");
                wpData.set(normalize(name), {
                    name,
                    price: null,
                    desc,
                    src: imageUrl || null,
                    source,
                    sourceUrl: product?.link || url,
                });
            }
            if (products.length < 100) break;
        }

        const updates = buildVenueUpdates(venueInfo, venue, url, source);
        if (Object.keys(updates).length > 0) {
            await applyUpdate("venues", updates, venue.id);
            console.log(`    Updated venue info: logo=${!!updates.logo_url}, image=${Object.prototype.hasOwnProperty.call(updates, "image_url")}`);
        }

        return await processMatches(wpData, missingDishes, venue);
    } catch (e) {
        console.log(`    [!] WordPress product scrape failed: ${e.message}`);
        return 0;
    }
}

function sanitizeExtractedItem(item) {
    const name = cleanText(item?.name);
    const displayName = stripMenuItemCodePrefix(name);
    const price = item?.price ? cleanText(item.price) : item?.price;
    const desc = item?.desc ? stripDescriptionBoilerplate(item.desc, price) : item?.desc;
    const source = item?.source || "oddle";
    return {
        ...item,
        src: normalizeVenueImageUrl(item?.src, source),
        source,
        name,
        displayName,
        matchName: displayName,
        desc: isUsefulDescription(desc, displayName, price) ? desc : null,
        price,
    };
}

async function processMatches(extractedDataMap, missingDishes, venue) {
    if (!venue?.id) {
        console.log(`    [!] Cannot apply updates for venue with missing id (${venue?.name || "unknown"}). Skipping.`);
        return 0;
    }

    const sanitizedDataMap = new Map();
    for (const [key, rawItem] of extractedDataMap.entries()) {
        const item = sanitizeExtractedItem(rawItem);
        sanitizedDataMap.set(normalizeDishNameForMatch(item.matchName || item.name) || key, item);
    }
    const existingDishNameSet = await fetchVenueDishNameSet(venue.id);
    console.log(`  Found ${sanitizedDataMap.size} items on page.`);
    let matchedCount = 0;
    const matchedKeys = new Set();
    const dishUpdates = [];

    // 1. Enrich existing dishes
    for (const d of missingDishes) {
        if (isLikelyMenuOptionName(d.name)) {
            console.log(`    [-] Skipping option-like existing dish: ${d.name}`);
            continue;
        }
        const normName = normalizeDishNameForMatch(d.name);
        let matchedItem = sanitizedDataMap.get(normName);
        let matchKey = normName;

        if (!matchedItem && normName.length > 5) {
             for (const [pName, pItem] of sanitizedDataMap.entries()) {
               if (isSafeFuzzyDishMatch(d.name, pItem.matchName || pItem.name)) {
                 matchedItem = pItem;
                 matchKey = pName;
                 break;
               }
             }
        }

        if (matchedItem) {
            matchedKeys.add(matchKey);
            console.log(`    Matched ${d.name} -> Img: ${matchedItem.src ? 'Yes' : 'No'}, Price: ${matchedItem.price}, Desc: ${matchedItem.desc ? 'Yes' : 'No'}`);

            const updates = {};
            const parsedPrice = parsePrice(matchedItem.price);
            const sourceUrl = matchedItem.sourceUrl || venue.menu_source_url || null;
            const rightsStatus = mediaRightsStatusForSource(matchedItem.source);
            const sourceRightsApproved = sourceHasApprovedRights(matchedItem.source);
            const existingMenuIsApproved = Boolean(d.menu_approved_for_display) &&
                ["merchant_owned", "operator_owned", "permitted_api", "licensed"].includes(d.menu_rights_status);
            const canApplyMenuFields = sourceRightsApproved || !existingMenuIsApproved;
            const approvedImageUrl =
                matchedItem.src && !d.image_url
                    ? await getApprovedOfficialImageUrl(matchedItem.src, matchedItem.source, d.name)
                    : null;
            if (approvedImageUrl) {
                updates.image_url = approvedImageUrl;
                updates.media_source_url = sourceUrl;
                updates.media_approved_for_display = true;
                updates.media_rights_status = rightsStatus;
            }
            if (matchedItem.price && canApplyMenuFields) {
                if (isValidMenuPrice(parsedPrice)) {
                    const existingPrice = Number.parseFloat(d.price);
                    const fixedPriceRange = formatSgd(parsedPrice);
                    const existingPriceMatches = Number.isFinite(existingPrice) && Math.abs(existingPrice - parsedPrice) <= 0.001;
                    if (!Number.isFinite(existingPrice)) {
                        updates.price = parsedPrice;
                    }
                    if ((!d.price_range || d.price_range !== fixedPriceRange) && (!Number.isFinite(existingPrice) || existingPriceMatches)) {
                        updates.price_range = fixedPriceRange;
                    }
                    if (Number.isFinite(existingPrice) && !existingPriceMatches) {
                        console.log(`      [-] Keeping existing price for ${d.name}; source price differs (${d.price} vs ${parsedPrice}).`);
                    }
                } else if (Number.isFinite(parsedPrice)) {
                    console.log(`      [-] Ignoring sentinel price for ${d.name}: ${matchedItem.price}`);
                }
            }
            if (matchedItem.desc && matchedItem.desc.length > 5 && !d.description && canApplyMenuFields) {
                updates.description = matchedItem.desc.substring(0, 500); // truncate if too long
            }
            if (!canApplyMenuFields) {
                console.log(`      [-] Keeping approved provenance for ${d.name}; ${matchedItem.source} remains review-only.`);
            }
            if ((updates.price || updates.description || updates.image_url) && sourceUrl) {
                updates.menu_source_url = sourceUrl;
                updates.menu_approved_for_display = sourceRightsApproved;
                updates.menu_rights_status = rightsStatus;
            }
            const actionable = Object.keys(updates).length > 0;
            exportedRows.push({
                action: actionable ? "update" : "noop",
                actionable,
                noop_reason: actionable ? null : "matched_source_but_no_writable_field_changed",
                venue_id: venue.id,
                venue_name: venue.name,
                dish_id: d.id,
                dish_name: d.name,
                source_name: matchedItem.name,
                source_image_url: matchedItem.src ?? null,
                source_price: Number.isFinite(parsedPrice) ? parsedPrice : null,
                source_description: matchedItem.desc ?? null,
                image_url: updates.image_url ?? null,
                price: updates.price ?? null,
                price_range: updates.price_range ?? null,
                description: updates.description ?? null,
                media_source_url: updates.media_source_url ?? sourceUrl,
                menu_source_url: updates.menu_source_url ?? sourceUrl,
                media_rights_status: updates.media_rights_status ?? rightsStatus,
                menu_rights_status: updates.menu_rights_status ?? rightsStatus,
            });

            if (actionable) {
                dishUpdates.push({ id: d.id, ...updates });
            }
        }
    }
    if (dishUpdates.length > 0) {
        const { count, error } = await applyBatchUpdate("dishes", dishUpdates, `updates:${venue.id}`);
        if (error) {
            console.log(`      Error updating dish batch: ${error.message}`);
        }
        matchedCount += count ?? 0;
    }
    console.log(`  Updated ${matchedCount} / ${missingDishes.length} existing dishes.`);

    // 2. Insert new dishes
    let insertedCount = 0;
    const newDishes = [];
    if (!runOptions.allowInserts) {
        console.log("  Skipping new dish inserts because --no-inserts is set.");
    } else for (const [key, item] of sanitizedDataMap.entries()) {
        if (!matchedKeys.has(key)) {
        if (item.allowInsert === false) {
            console.log(`    [-] Keeping review-only ${item.source} item out of inserts: ${item.name}`);
            continue;
        }
        if (isLikelyMenuOptionName(item.name)) {
            console.log(`    [-] Skipping option-like extracted item: ${item.name}`);
            continue;
        }
        if (!venue.id) {
            console.log(`    [-] Skipping new dish ${item.name} because venue id is missing`);
            continue;
        }
	        const itemNorm = normalizeDishNameForMatch(item.matchName || item.name);
        const existsExactName = existingDishNameSet.has(itemNorm);

            if (!existsExactName) {
                const approvedNewDishImageUrl = await getApprovedOfficialImageUrl(item.src, item.source, item.name);
                if (item.src && !approvedNewDishImageUrl && sourceHasApprovedRights(item.source)) {
                    console.log(`    [-] Skipping new dish with non-approved official image: ${item.name}`);
                    continue;
                }
                const newDish = {
                    id: crypto.randomUUID(),
                    venue_id: venue.id,
                    building_id: venue.building_id,
	                    name: (item.displayName || item.name).substring(0, 255),
                    image_url: approvedNewDishImageUrl,
                    description: item.desc ? item.desc.substring(0, 500) : null,
                    price: null,
                    price_range: null,
                    media_approved_for_display: false,
                    media_rights_status: "unverified",
                    media_source_url: null,
                    menu_approved_for_display: sourceHasApprovedRights(item.source),
                    menu_rights_status: mediaRightsStatusForSource(item.source),
                    menu_source_url: item.sourceUrl || venue.menu_source_url || null,
                };

                if (item.price) {
                    const parsedPrice = parsePrice(item.price);
                    if (isValidMenuPrice(parsedPrice)) {
                        newDish.price = parsedPrice;
                        newDish.price_range = formatSgd(parsedPrice);
                    } else if (Number.isFinite(parsedPrice)) {
                        console.log(`    [-] Ignoring sentinel price for new dish: ${item.name} (${item.price})`);
                    }
                }
                if (newDish.price === null) {
                    console.log(`    [-] Skipping new dish without parsable price: ${newDish.name}`);
                    continue;
                }
                if (newDish.image_url) {
                    newDish.media_approved_for_display = true;
                    newDish.media_rights_status = mediaRightsStatusForSource(item.source);
                    newDish.media_source_url = item.sourceUrl || venue.menu_source_url || null;
                }
                exportedRows.push({
                    action: "insert",
                    actionable: true,
                    noop_reason: null,
                    venue_id: venue.id,
                    venue_name: venue.name,
                    dish_id: null,
                    dish_name: newDish.name,
                    source_name: item.name,
                    source_image_url: item.src ?? null,
                    source_price: newDish.price,
                    source_description: item.desc ?? null,
                    image_url: newDish.image_url,
                    price: newDish.price,
                    price_range: newDish.price_range,
                    description: newDish.description,
                    media_source_url: newDish.media_source_url,
                    menu_source_url: newDish.menu_source_url,
                    media_rights_status: newDish.media_rights_status,
                    menu_rights_status: newDish.menu_rights_status,
                });

                newDishes.push(newDish);
            }
        }
    }
    if (newDishes.length > 0) {
        const { count, error } = await applyBatchUpsert("dishes", newDishes, `inserts:${venue.id}`);
        if (error) {
            console.log(`    [!] Error inserting dish batch: ${error.message}`);
        }
        insertedCount += count ?? 0;
        for (const dish of newDishes.slice(0, insertedCount)) {
            console.log(`    [+] ${runOptions.dryRun ? "Would insert" : "Inserted"} new dish: ${dish.name}`);
        }
    }

    if (insertedCount > 0) console.log(`  Inserted ${insertedCount} new dishes.`);
    return matchedCount + insertedCount;
}

async function fetchMissingDishesForVenue(venueId, limit) {
    console.log(`  [db] Fetching missing dishes for venue ${venueId} (limit=${limit})`);
    let result = await safeWithTimeout(
        supabase
            .from("dishes")
            .select("id,name,image_url,price,price_range,description,venue_id,media_approved_for_display,media_rights_status,media_source_url,menu_approved_for_display,menu_rights_status,menu_source_url")
            .eq("venue_id", venueId)
            .order("id", { ascending: true })
            .limit(limit),
        `fetchMissingDishesForVenue:${venueId}:orderedPageFallback`,
    );

    if (result.error) {
        console.log(
            `  [db] Primary venue dish query timed out for ${venueId}, retrying with paginated scan`,
        );
        const rows = [];
        let offset = 0;
        while (rows.length < limit) {
            const pageResult = await safeWithTimeout(
                supabase
                    .from("dishes")
                    .select("id,name,image_url,price,price_range,description,venue_id,media_approved_for_display,media_rights_status,media_source_url,menu_approved_for_display,menu_rights_status,menu_source_url")
                    .eq("venue_id", venueId)
                    .order("id", { ascending: true })
                    .range(offset, Math.min(offset + PAGINATED_FETCH_PAGE_SIZE - 1, limit - 1)),
                `fetchMissingDishesForVenue:${venueId}:pagination:${offset}`,
            );
            if (pageResult.error) {
                return { ...pageResult, data: rows };
            }
            if (!Array.isArray(pageResult.data) || pageResult.data.length === 0) {
                break;
            }
            rows.push(...pageResult.data);
            if (pageResult.data.length < PAGINATED_FETCH_PAGE_SIZE) {
                break;
            }
            offset += PAGINATED_FETCH_PAGE_SIZE;
        }
        result = { data: rows };
    }

    if (result.error) return result;
    return {
        ...result,
        data: (result.data ?? []).filter(
            (dish) => !dish.image_url || dish.price === null || !dish.price_range || !dish.description,
        ),
    };
}

async function fetchVenueById(venueId) {
    console.log(`  [db] Fetching venue by id ${venueId}`);
    return safeWithTimeout(
        supabase
            .from("venues")
            .select("id,name,building_id,menu_source_url,logo_url,image_url,address,postal_code")
            .eq("id", venueId)
            .maybeSingle(),
        `fetchVenueById:${venueId}`,
    );
}

async function fetchKnownSourceVenues(limit) {
    console.log(`  [db] Fetching known-source venues (limit=${limit})`);
    return safeWithTimeout(
        supabase
            .from("venues")
            .select("id,name,building_id,menu_source_url,logo_url,image_url,address,postal_code")
            .not("menu_source_url", "is", null)
            .order("id", { ascending: true })
            .limit(limit),
        "fetchKnownSourceVenues",
    );
}

async function fetchKnownSourceVenuesFromWorkbook(limit, workbookPath = "data/Hungry F&B Database.xlsx") {
    console.log(`  [offline] Falling back to known-source venues from ${workbookPath} (limit=${limit})`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    const rows = sheetRows(workbook, "Supabase Venues");
    return rows
        .map((row) => ({
            id: cleanText(row.id),
            name: cleanText(row.name),
            building_id: cleanText(row.building_id),
            menu_source_url: cleanText(row.menu_source_url),
            logo_url: cleanText(row.logo_url),
            image_url: cleanText(row.image_url),
            address: cleanText(row.address),
            postal_code: cleanText(row.postal_code),
        }))
        .filter((venue) => venue.id && venue.menu_source_url)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit);
}

function sheetRows(workbook, sheetName) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) return [];
    const headers = sheet.getRow(1).values.slice(1).map((value) => cleanText(value));
    const rows = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const record = {};
        for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
            const header = headers[columnIndex];
            if (!header) continue;
            const value = row.getCell(columnIndex + 1).value;
            if (value && typeof value === "object") {
                if ("result" in value) record[header] = value.result;
                else if ("text" in value) record[header] = value.text;
                else if ("richText" in value) record[header] = value.richText.map((part) => part.text).join("");
                else record[header] = value;
            } else {
                record[header] = value ?? null;
            }
        }
        rows.push(record);
    }
    return rows;
}

async function fetchOfflineVenueGroup(venueId, workbookPath, sourceUrl) {
    console.log(`  [offline] Loading venue ${venueId} from ${workbookPath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    const venues = sheetRows(workbook, "Supabase Venues");
    const dishes = sheetRows(workbook, "Supabase Dishes");
    const venueRow = venues.find((row) => cleanText(row.id) === venueId);
    if (!venueRow) {
        throw new Error(`Venue ${venueId} not found in Supabase Venues sheet.`);
    }
    const venue = {
        id: cleanText(venueRow.id),
        name: cleanText(venueRow.name),
        building_id: cleanText(venueRow.building_id),
        menu_source_url: sourceUrl || cleanText(venueRow.menu_source_url),
        logo_url: cleanText(venueRow.logo_url),
        address: cleanText(venueRow.address),
        postal_code: cleanText(venueRow.postal_code),
    };
    const missingDishes = dishes
        .filter((row) => cleanText(row.venue_id) === venue.id)
        .map((row) => ({
            id: cleanText(row.id),
            name: cleanText(row.name),
            image_url: cleanText(row.image_url),
            price: row.price,
            price_range: cleanText(row.price_range),
            description: cleanText(row.description),
            venue_id: venue.id,
            media_approved_for_display: Boolean(row.media_approved_for_display),
            media_rights_status: cleanText(row.media_rights_status),
            media_source_url: cleanText(row.media_source_url),
            menu_approved_for_display: Boolean(row.menu_approved_for_display),
            menu_rights_status: cleanText(row.menu_rights_status),
            menu_source_url: cleanText(row.menu_source_url),
        }))
        .filter((dish) => !dish.image_url || dish.price === null || dish.price === undefined || !dish.price_range || !dish.description)
        .slice(0, runOptions.fetchLimit);
    return [{ venue, dishes: missingDishes }];
}

async function fetchMissingDishVenueGroups() {
    if (runOptions.offlineWorkbook && runOptions.venueId) {
        return fetchOfflineVenueGroup(runOptions.venueId, runOptions.offlineWorkbook, runOptions.sourceUrl);
    }

    if (runOptions.venueId || runOptions.knownSourcesOnly) {
        const venues = [];
        if (runOptions.venueId) {
            const { data: venue, error } = await fetchVenueById(runOptions.venueId);
            if (error) throw error;
            if (venue) venues.push(venue);
        } else {
            const venueScanLimit = Math.min(
                runOptions.fetchLimit,
                checkpointState.completedVenueIds.size + Math.max(MIN_CANDIDATE_GROUP_SCAN_LIMIT, runOptions.limit * 10),
            );
            const { data, error } = await fetchKnownSourceVenues(venueScanLimit);
            if (error) {
                console.log(`  [db] Known-source venue scan failed: ${error.message}. Trying workbook fallback.`);
                venues.push(...await fetchKnownSourceVenuesFromWorkbook(runOptions.limit));
            } else {
                venues.push(...(data ?? []));
            }
        }

        const groups = [];
        const candidateGroupScanLimit = Math.min(
            runOptions.fetchLimit,
            Math.max(MIN_CANDIDATE_GROUP_SCAN_LIMIT, runOptions.limit * 10),
        );
        for (const venue of venues) {
            if (checkpointState.completedVenueIds.has(venue.id)) continue;
            if (shouldSkipVenue(venue)) {
                console.log(`  [db] Skipping excluded venue ${venue.name || venue.id}`);
                continue;
            }
            const { data: dishes, error } = await fetchMissingDishesForVenue(
                venue.id,
                runOptions.fetchLimit,
            );
            if (error) {
                console.log(`  [!] Skipping venue ${venue.name} due dish lookup timeout: ${error.message}`);
                continue;
            }
            if (dishes?.length) {
                groups.push({ venue, dishes });
            }
            if (groups.length >= candidateGroupScanLimit) {
                break;
            }
        }
        return groups;
    }

    // Get dishes missing images or price or description. This joined fallback is
    // intentionally reserved for exploratory discovery; known-source and
    // targeted runs use the lower-cost venue-first path above.
    const { data: dishes, error } = await safeWithTimeout(
        supabase
            .from("dishes")
            .select(`
              id,
              name,
              image_url,
              price,
              price_range,
              description,
              media_approved_for_display,
              media_rights_status,
              media_source_url,
              menu_approved_for_display,
              menu_rights_status,
              menu_source_url,
              venues!inner (
                id,
                name,
                building_id,
                menu_source_url,
                logo_url,
                address,
                postal_code
              )
            `)
            .or("image_url.is.null,price.is.null,price_range.is.null,description.is.null")
            .limit(runOptions.fetchLimit),
        "fetchMissingDishesFallback",
    );

    if (error) throw error;

    const venueDishes = new Map();
    for (const dish of dishes ?? []) {
        const venue = dish.venues;
        if (!venueDishes.has(venue.id)) {
            venueDishes.set(venue.id, { venue, dishes: [] });
        }
        venueDishes.get(venue.id).dishes.push(dish);
    }
    return Array.from(venueDishes.values());
}

function platformForUrl(url) {
  if (!url) return null;
  return Object.entries(PLATFORM_ADAPTERS)
    .find(([, adapter]) => adapter.routeIsValid(url))?.[0] || null;
}

function isOfficialOrderingSource(url) {
  return Boolean(url) && !platformForUrl(url) && !/data\.gov\.sg|sfa\.gov\.sg/i.test(url);
}

async function scrapeOfficialSource(page, preferredSourceUrl, missing, venue) {
  if (!isOfficialOrderingSource(preferredSourceUrl)) return 0;
  let success = 0;
  if (/order\.|getz/i.test(preferredSourceUrl)) {
    success = await scrapeGetz(page, preferredSourceUrl, missing, venue);
  }
  if (success === 0) success = await scrapeWooCommerce(page, preferredSourceUrl, missing, venue);
  if (success === 0) success = await scrapeShopify(page, preferredSourceUrl, missing, venue);
  if (success === 0) success = await scrapeWordPressProducts(page, preferredSourceUrl, missing, venue);
  return success;
}

async function processVenueGroup(page, group, index, total) {
  const { venue, dishes: missing } = group;
  return venueRunContext.run({ writeError: false, scrapeFailure: false }, async () => {
    if (checkpointState.completedVenueIds.has(venue.id)) {
      console.log(`\n[${index + 1}/${total}] ${venue.name} already completed in checkpoint; skipping.`);
      return 0;
    }
    console.log(`\n[${index + 1}/${total}] ${venue.name} (Missing info for ${missing.length} dishes)`);
    const preferredSourceUrl = runOptions.sourceUrl || venue.menu_source_url || null;
    const preferredPlatform = platformForUrl(preferredSourceUrl);

    if (venueNameTokens(venue.name).length === 0 && !isOfficialOrderingSource(runOptions.sourceUrl)) {
      console.log(`  Skipping placeholder/generic venue name: ${venue.name}`);
      await saveCheckpoint(index, venue, 0);
      return 0;
    }

    let success = 0;
    if (preferredPlatform) {
      success = await scrapePlatform(page, preferredPlatform, preferredSourceUrl, missing, venue);
    } else {
      success = await scrapeOfficialSource(page, preferredSourceUrl, missing, venue);
    }

    if (success === 0 && !runOptions.knownSourcesOnly) {
      for (const platform of ["oddle", "grabfood", "foodpanda", "deliveroo"]) {
        if (platform === preferredPlatform) continue;
        console.log(`  Resolving ${PLATFORM_ADAPTERS[platform].label} directly...`);
        const sourceUrl = await resolvePlatformSourceUrl(page, venue, platform);
        if (!sourceUrl) continue;
        success = await scrapePlatform(page, platform, sourceUrl, missing, venue);
        if (success > 0) break;
      }
    }

    await saveCheckpoint(index, venue, success, currentVenueCompleted(success));
    if (runOptions.interVenueDelayMs > 0) await sleep(runOptions.interVenueDelayMs);
    return success;
  });
}

async function main() {
  console.log(
    `Fetching top venues with missing dish info... limit=${runOptions.limit}, fetchLimit=${runOptions.fetchLimit}, dryRun=${runOptions.dryRun}, knownSourcesOnly=${runOptions.knownSourcesOnly}, batchWriteSize=${runOptions.batchWriteSize}, workers=${runOptions.workers}`,
  );

  await loadCheckpoint();
  let venueGroups;
  try {
    venueGroups = await fetchMissingDishVenueGroups();
  } catch (error) {
    console.error("Error fetching dishes:", error);
    process.exitCode = 1;
    return;
  }

  const sortedVenues = venueGroups
    .filter(({ venue }) => !shouldSkipVenue(venue) && !checkpointState.completedVenueIds.has(venue.id))
    .sort((left, right) => {
      const sourceDelta = Number(hasKnownMenuSource(right.venue)) - Number(hasKnownMenuSource(left.venue));
      if (sourceDelta !== 0) return sourceDelta;
      return right.dishes.length - left.dishes.length;
    })
    .slice(0, runOptions.limit);

  console.log(`Found ${sortedVenues.length} top venues. Starting ${runOptions.workers}-worker scraper...`);
  const browser = await chromium.launch({ headless: runOptions.headless });
  const workerCount = Math.min(runOptions.workers, Math.max(1, sortedVenues.length));
  const contexts = await Promise.all(
    Array.from({ length: workerCount }, () => browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
    })),
  );
  const pages = await Promise.all(contexts.map(async (context) => {
    const page = await context.newPage();
    page.setDefaultTimeout(45_000);
    page.setDefaultNavigationTimeout(45_000);
    return page;
  }));

  let results = [];
  try {
    results = await runWorkerPool(sortedVenues, workerCount, async (group, index, workerId) => {
      if (consecutiveWriteTimeouts >= runOptions.maxWriteTimeouts) {
        console.log(`  [!] Worker ${workerId} stopped before ${group.venue.name}: write-timeout guard is open.`);
        return 0;
      }
      return processVenueGroup(pages[workerId - 1], group, index, sortedVenues.length);
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
    await browser.close();
  }

  await checkpointWriteQueue;
  if (runOptions.exportJsonPath) {
    const actionableCount = exportedRows.filter((row) => row.actionable !== false).length;
    await fs.mkdir(path.dirname(runOptions.exportJsonPath), { recursive: true });
    await fs.writeFile(
      runOptions.exportJsonPath,
      JSON.stringify({
        exported_at: new Date().toISOString(),
        dry_run: runOptions.dryRun,
        venue_id: runOptions.venueId,
        worker_count: workerCount,
        row_count: exportedRows.length,
        actionable_count: actionableCount,
        noop_count: exportedRows.length - actionableCount,
        rows: exportedRows,
      }, null, 2),
    );
    console.log(`Exported ${exportedRows.length} extracted rows to ${runOptions.exportJsonPath}`);
  }
  const totalSuccess = results.reduce((sum, value) => sum + (Number(value) || 0), 0);
  console.log(`\nFinished! Successfully enriched/inserted ${totalSuccess} dishes.`);
  // The Playwright browser is closed above, but Chromium can leave a handle
  // alive briefly on macOS. This is a standalone CLI, so terminate only after
  // all writes and the optional export have completed.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
