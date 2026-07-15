import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { loadDishDetailsInPages, requireSupabaseRows } from "@/lib/services/readSafety";

function read(pathFromRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRoot), "utf8");
}

function segmentBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing segment start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing segment end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("batch dish detail RPC falls back to bounded single-detail reads during migration skew", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const batchRead = segmentBetween(
    repository,
    "export async function getDishesByIdsViaRpc",
    "export async function getVenueByIdViaRpc",
  );

  assert.match(repository, /const MAX_BATCH_DISH_DETAILS = 100/);
  assert.match(repository, /const DISH_DETAIL_FALLBACK_CONCURRENCY = 8/);
  assert.match(repository, /rpcRows\("get_dish_detail_v2"/);
  assert.match(repository, /rpcRows\("get_dish_detail"/);
  assert.match(batchRead, /rpcRows\("get_dish_details"/);
  assert.match(batchRead, /if \(rows\) return rows\.map\(mapRpcDish\)/);
  assert.match(batchRead, /offset \+= DISH_DETAIL_FALLBACK_CONCURRENCY/);
  assert.match(
    batchRead,
    /Promise\.all\(chunk\.map\(\(dishId\) => getDishByIdViaRpc\(dishId\)\)\)/,
  );
  assert.match(batchRead, /fallbackDishes\.length > 0 \? fallbackDishes : undefined/);
  assert.match(service, /const dishes = await getDishesByIdsViaRpc\(dishIds\)/);
  assert.match(service, /if \(!dishes\) return undefined/);
});

test("versioned detail and batch RPCs return cuisine metadata without replacing the deployed signature", () => {
  const migration = read("supabase/migrations/20260715053000_batch_dish_detail_reads.sql");

  assert.match(migration, /create or replace function public\.get_dish_detail_v2/);
  assert.match(migration, /cuisine_tags text\[\]/);
  assert.match(
    migration,
    /coalesce\(d\.cuisine_tags, v\.cuisine_tags, '\{\}'::text\[\]\) as cuisine_tags/,
  );
  assert.match(migration, /public\.get_dish_detail_v2\(requested\.dish_id\)/);
  assert.doesNotMatch(migration, /drop function public\.get_dish_detail/);
});

test("every data provider implements the capped HungryService batch read", () => {
  const serviceTypes = read("src/lib/services/types.ts");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");
  const excel = read("src/lib/services/excel/excelService.ts");

  assert.match(serviceTypes, /getDishes\(ids: string\[\]\): Promise<DishDetail\[\]>/);
  for (const source of [supabase, mock, excel]) {
    assert.match(source, /async getDishes\(ids\)/);
  }
  assert.match(supabase, /loadDishDetailsInPages\(ids, getDishesByIdsViaRpc\)/);
  assert.doesNotMatch(supabase, /uniqueIds[\s\S]{0,500}supabaseRepository\.getDishById/);
});

test("batch page loader executes every page and rejects unavailable live pages", async () => {
  const pageSizes: number[] = [];
  const ids = Array.from({ length: 205 }, (_, index) => `dish-${index}`);
  const result = await loadDishDetailsInPages(ids, async (pageIds) => {
    pageSizes.push(pageIds.length);
    return [];
  });

  assert.deepEqual(pageSizes, [100, 100, 5]);
  assert.deepEqual(result, []);

  await assert.rejects(
    loadDishDetailsInPages(["dish-1"], async () => undefined),
    /Dish details are temporarily unavailable/,
  );
  await assert.rejects(
    loadDishDetailsInPages(
      Array.from({ length: 1_001 }, (_, index) => `dish-${index}`),
      async () => [],
    ),
    /Too many dish details requested/,
  );
});

test("mock batch read preserves request order, removes duplicates, and omits unknown ids", async () => {
  const first = dishes[0];
  const second = dishes[1];
  assert.ok(first);
  assert.ok(second);

  const resolved = await hungryService.discovery.getDishes([
    second.id,
    first.id,
    second.id,
    "missing-dish",
  ]);

  assert.deepEqual(
    resolved.map((dish) => dish.id),
    [second.id, first.id],
  );

  const afterFirstPage = await hungryService.discovery.getDishes([
    ...Array.from({ length: 100 }, (_, index) => `missing-${index}`),
    first.id,
  ]);
  assert.deepEqual(
    afterFirstPage.map((dish) => dish.id),
    [first.id],
  );

  await assert.rejects(
    hungryService.discovery.getDishes(Array.from({ length: 1_001 }, (_, index) => `dish-${index}`)),
    /Too many dish details requested/,
  );
});

test("profile lists use one batch detail read and no per-item venue hydration", () => {
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  const visited = read("src/app/screens/profile/VisitedStallsScreen.tsx");
  const reviews = read("src/app/screens/profile/ReviewHistoryScreen.tsx");

  for (const source of [favourites, visited, reviews]) {
    assert.match(source, /service\.discovery\s*\.getDishes/);
    assert.doesNotMatch(source, /service\.discovery\.getDish\(/);
    assert.doesNotMatch(source, /service\.discovery\.getVenue\(/);
  }
  assert.match(reviews, /service\.reviews\s*\.getUserReviews/);
});

test("Supabase profile reads preserve failure states instead of returning false-empty data", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const userReviews = segmentBetween(service, "async getUserReviews(userId)", "async submitReview");

  assert.match(userReviews, /requireSupabaseRows<Row>/);
  assert.doesNotMatch(userReviews, /return \[\]/);
});

test("Supabase row guard propagates backend failures and rejects invalid responses", () => {
  const backendError = new Error("backend unavailable");
  assert.throws(() => requireSupabaseRows([], backendError, "invalid"), backendError);
  assert.throws(() => requireSupabaseRows(null, null, "invalid response"), /invalid response/);
  assert.deepEqual(requireSupabaseRows([], null, "invalid"), []);
});
