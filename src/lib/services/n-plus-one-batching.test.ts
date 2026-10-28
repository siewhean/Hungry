import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { dishes, venues } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

test("discovery.getItemDetails names dishes and stalls in one call", async () => {
  const dish = dishes[0];
  const venue = venues[0];
  const rows = await hungryService.discovery.getItemDetails({
    dishIds: [dish.id, "missing-dish"],
    stallIds: [venue.id],
  });

  assert.equal(rows.length, 2, "ids that do not exist are left out");
  assert.equal(rows.find((row) => row.dishId === dish.id)?.name, dish.name);
  assert.equal(rows.find((row) => row.stallId === venue.id)?.name, venue.name);
});

test("discovery.getVenuesByIds returns the stalls that exist, once each", async () => {
  const [first, second] = venues;
  const rows = await hungryService.discovery.getVenuesByIds([
    first.id,
    second.id,
    first.id,
    "nope",
  ]);
  assert.deepEqual(rows.map((row) => row.id).sort(), [first.id, second.id].sort());
});

test("merchant.setDishesSoldOut flags many dishes and reports the ones that changed", async () => {
  const outletId = "outlet-wonton-mee";
  const first = await hungryService.merchant.addDish(outletId, {
    name: "Batch test A",
    price: 4,
    tasteTags: [],
  });
  const second = await hungryService.merchant.addDish(outletId, {
    name: "Batch test B",
    price: 5,
    tasteTags: [],
  });
  const ids = [first.id, second.id];

  const marked = await hungryService.merchant.setDishesSoldOut(outletId, ids, true);
  assert.deepEqual([...marked].sort(), [...ids].sort());
  const flagged = await hungryService.merchant.getMenu(outletId);
  assert.ok(
    ids.every((id) =>
      flagged.find((dish) => dish.id === id)?.availabilityFlags.includes("Sold out"),
    ),
  );

  const cleared = await hungryService.merchant.setDishesSoldOut(
    outletId,
    [...ids, "missing"],
    false,
  );
  assert.deepEqual([...cleared].sort(), [...ids].sort());
});

test("merchant.acceptOCRDrafts accepts every pending draft and reports failures", async () => {
  const outletId = "outlet-wonton-mee";
  const pending = (await hungryService.merchant.getOCRDrafts(outletId)).filter(
    (draft) => draft.status === "pending",
  );
  assert.ok(pending.length >= 1, "Expected pending OCR draft fixtures");
  const ids = pending.map((draft) => draft.id);

  const result = await hungryService.merchant.acceptOCRDrafts([...ids, "missing-draft"]);
  assert.deepEqual([...result.acceptedIds].sort(), [...ids].sort());
  assert.deepEqual(result.failedIds, ["missing-draft"]);
});

test("the Supabase service reads many rows with one batched call, not one call per row", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");

  assert.match(repository, /rpcRows\("get_venue_summaries", \{ p_venue_ids: ids \}\)/);
  // Item details go out in chunks of 200 ids at once, not one call per id.
  assert.match(
    repository,
    /rpcRows\("get_item_details", \{ p_dish_ids: dishes, p_stall_ids: stalls \}\)/,
  );
  assert.match(repository, /dishIds\.slice\(start, start \+ 200\)/);
  assert.match(service, /client\.rpc\("merchant_set_dishes_availability_flag"/);
  assert.match(service, /client\.rpc\("reorder_popular_visitor_pins"/);
  // Draft accept reads the drafts once with .in(), then the outlets once.
  assert.match(service, /from\("dishes_draft"\)\s*\.select\("\*"\)\s*\.in\("id", ids\)/);
  // Photos of a submissions list are signed per bucket, not per photo.
  assert.match(service, /const presigned = await presignSubmissionPhotos\(client, rows\);/);
});

test("screens use the batched reads", () => {
  assert.match(
    read("src/features/checklistPortfolio/useItemLabels.ts"),
    /discovery\.getItemDetails\(/,
  );
  assert.match(
    read("src/app/screens/discover/DecideForMeResultScreen.tsx"),
    /discovery\.getVenuesByIds\(venueIds\)/,
  );
  assert.match(
    read("src/app/screens/merchant/MerchantMenuScreen.tsx"),
    /merchant\.setDishesSoldOut\(/,
  );
  assert.match(read("src/app/screens/merchant/OCRDraftScreen.tsx"), /merchant\.acceptOCRDrafts\(/);
});

test("the OCR worker and the notification worker write in batches", () => {
  const ocr = read("supabase/functions/ingest-menu-photo/index.ts");
  assert.match(ocr, /client\.rpc\("apply_menu_draft_matches"/);
  assert.match(ocr, /from\("dishes_draft"\)\.insert\(newDrafts\)/);
  const notifications = read("supabase/functions/send-notifications/index.ts");
  assert.match(notifications, /queueFinish\(job\.id, \{ status: "skipped"/);
  assert.match(notifications, /deadTokensToRemove/);
});
