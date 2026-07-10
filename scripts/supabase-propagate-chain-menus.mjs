import crypto from "crypto";
import { loadProjectEnv } from "./load-project-env.mjs";
import { createClient } from "@supabase/supabase-js";

loadProjectEnv();

const supabaseUrl = process.env.HUNGRY_SUPABASE_IMPORT_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or service role key for chain menu propagation.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const WRITE_CHUNK_SIZE = 100;
const APPROVED_RIGHTS = new Set(["merchant_owned", "operator_owned", "permitted_api", "licensed"]);

function parseArgs(argv) {
  const options = { apply: false, brandId: null, sourceVenueId: null, limit: 10 };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg.startsWith("--brand-id=")) options.brandId = arg.slice("--brand-id=".length) || null;
    else if (arg.startsWith("--source-venue-id=")) options.sourceVenueId = arg.slice("--source-venue-id=".length) || null;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(1, Number(arg.slice("--limit=".length)) || 10);
  }
  return options;
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function deterministicDishId(targetVenueId, sourceDishId) {
  const digest = crypto.createHash("sha256").update(`${targetVenueId}:${sourceDishId}`).digest("hex").slice(0, 40);
  return `dsh-chain-${digest}`;
}

function cloneApprovedMenuDish(sourceDish, targetVenue) {
  // Do not clone outlet-specific counters, crowd state, review data, or unknown future columns.
  const copyMedia =
    Boolean(sourceDish.image_url) &&
    sourceDish.media_approved_for_display === true &&
    APPROVED_RIGHTS.has(sourceDish.media_rights_status);
  return {
    id: deterministicDishId(targetVenue.id, sourceDish.id),
    venue_id: targetVenue.id,
    building_id: targetVenue.building_id,
    name: sourceDish.name,
    description: sourceDish.description,
    image_url: copyMedia ? sourceDish.image_url : null,
    price: sourceDish.price ?? 0,
    price_range: sourceDish.price_range ?? "",
    source_type: sourceDish.source_type,
    source_confidence: sourceDish.source_confidence,
    food_type_tag: sourceDish.food_type_tag,
    media_approved_for_display: copyMedia,
    media_rights_status: copyMedia ? sourceDish.media_rights_status : "unverified",
    media_source_url: copyMedia ? sourceDish.media_source_url : null,
    menu_approved_for_display: sourceDish.menu_approved_for_display,
    menu_rights_status: sourceDish.menu_rights_status,
    menu_source_url: sourceDish.menu_source_url,
  };
}

function chunks(rows, size = WRITE_CHUNK_SIZE) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
}

async function fetchAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`=== CHAIN MENU PROPAGATION (${options.apply ? "APPLY" : "DRY RUN"}) ===`);
  console.log("Eligibility: confirmed shared brand, approved source menu, and target with no dishes.");

  const venues = (await fetchAll(
    "venues",
    "id,name,building_id,stall_brand_id,stall_brand_match_status,menu_approved_for_display,menu_rights_status,menu_source_url",
  )).filter((venue) => venue.stall_brand_id && venue.stall_brand_match_status === "confirmed");
  const dishes = await fetchAll("dishes", "id,venue_id");
  const dishVenueIds = new Set(dishes.map((dish) => dish.venue_id));
  const byBrand = new Map();
  for (const venue of venues) {
    if (!byBrand.has(venue.stall_brand_id)) byBrand.set(venue.stall_brand_id, []);
    byBrand.get(venue.stall_brand_id).push(venue);
  }

  const candidates = [];
  for (const [brandId, brandVenues] of byBrand) {
    if (options.brandId && brandId !== options.brandId) continue;
  const sources = brandVenues.filter(
      (venue) =>
        dishVenueIds.has(venue.id) &&
        venue.menu_approved_for_display === true &&
        APPROVED_RIGHTS.has(venue.menu_rights_status) &&
        sourceHost(venue.menu_source_url),
    );
    for (const source of sources) {
      if (options.sourceVenueId && source.id !== options.sourceVenueId) continue;
      const sourceDomain = sourceHost(source.menu_source_url);
      const targets = brandVenues.filter(
        (target) =>
          target.id !== source.id &&
          !dishVenueIds.has(target.id) &&
          (!target.menu_source_url || sourceHost(target.menu_source_url) === sourceDomain),
      );
      if (targets.length) candidates.push({ brandId, source, targets });
      break;
    }
  }

  const limited = candidates.slice(0, options.limit);
  console.log(`Eligible brand groups: ${candidates.length}; selected: ${limited.length}.`);
  for (const candidate of limited) {
    console.log(`- ${candidate.source.name} (${candidate.source.id}) -> ${candidate.targets.length} confirmed-brand empty outlets`);
  }
  if (!options.apply || limited.length === 0) return;

  let venuesUpdated = 0;
  let dishesUpserted = 0;
  for (const { source, targets } of limited) {
    const { data: sourceDishes, error } = await supabase
      .from("dishes")
      .select("id,name,description,image_url,price,price_range,source_type,source_confidence,food_type_tag,media_approved_for_display,media_rights_status,media_source_url,menu_approved_for_display,menu_rights_status,menu_source_url")
      .eq("venue_id", source.id)
      .eq("menu_approved_for_display", true)
      .in("menu_rights_status", Array.from(APPROVED_RIGHTS));
    if (error) throw error;
    if (!sourceDishes?.length) continue;

    const clonedDishes = targets.flatMap((target) => sourceDishes.map((dish) => cloneApprovedMenuDish(dish, target)));
    for (const chunk of chunks(clonedDishes)) {
      const { error: upsertError } = await supabase.from("dishes").upsert(chunk, { onConflict: "id" });
      if (upsertError) throw upsertError;
      dishesUpserted += chunk.length;
    }

    const targetIds = targets.map((target) => target.id);
    const { error: venueError } = await supabase
      .from("venues")
      .update({
        menu_approved_for_display: source.menu_approved_for_display,
        menu_rights_status: source.menu_rights_status,
        menu_source_url: source.menu_source_url,
      })
      .in("id", targetIds);
    if (venueError) throw venueError;
    venuesUpdated += targets.length;
  }
  console.log(`Applied ${dishesUpserted} dish upserts across ${venuesUpdated} outlets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
