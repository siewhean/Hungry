import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
const dish = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");

test("detail-M1/M15/L12: stall interaction bar loads first, rolls back and reports failures", () => {
  const bar = readRepoFile("src/components/stall/StallInteractionBar.tsx");
  const store = readRepoFile("src/store/useStallInteractionStore.ts");

  assert.match(bar, /loadInteractions\(/);
  assert.match(bar, /ActivityIndicator/);
  assert.match(bar, /onRequireAuth/);
  // Un-marking Visited never asks for a review first.
  assert.match(bar, /!isTried && !hasReviewed/);
  assert.match(store, /function rollbackInteraction\(/);
  assert.match(store, /rollbackInteraction\(stallId, updated, existing\)/);
  // The dish page checks the freshly loaded state before marking the stall.
  assert.match(dish, /loadStallInteractions\(profile\.id\)/);
  assert.match(dish, /stallMarkFailed/);
  // The guest branch could never run: the bar is shown to everyone now.
  assert.doesNotMatch(stall, /handleReviewRequiredForTried[\s\S]{0,200}!isAuthenticated/);
});

test("detail-M3/M17/L17/L24: sold-out dishes and prices read the same everywhere", () => {
  const card = readRepoFile("src/components/dish/DishCard.tsx");

  assert.match(dish, /Sold out today/);
  assert.match(dish, /isSoldOut\(item\.availabilityFlags\)\s*\? "sold out today"/);
  assert.match(stall, /function menuDishAccessibilityLabel/);
  assert.match(card, /formatDishPrice/);
  assert.match(card, /No ratings yet/);
  assert.match(card, /reviewCount > 0 && /);
  assert.doesNotMatch(card, /distanceMeters/);
  assert.match(readRepoFile("src/app/screens/home/HomeFeedScreen.tsx"), /distanceLabel=\{/);
  // One static photo on a menu tile, not a cycling grid.
  assert.doesNotMatch(stall, /CyclingGridImage/);
});

test("detail-M6/L18/L20: dish page has no wait card, shows the exact score and Order buttons", () => {
  assert.doesNotMatch(dish, /formatWaitTime|getDataTrustDisclosure/);
  assert.doesNotMatch(dish, /Math\.round\(dish\.rating\)/);
  assert.match(dish, /<DeliveryButtonRow/);
  assert.match(dish, /if \(result\.reason !== "pending"\) showToast/);
});

test("detail-M7/M9/L9: stall reviews page by venue and the menu can be searched", () => {
  assert.match(stall, /STALL_REVIEW_PAGE_SIZE/);
  assert.match(stall, /label="See more reviews"/);
  assert.match(stall, /MENU_SEARCH_MIN_ITEMS/);
  assert.match(stall, /beforeId: last\.review\.id/);
  const service = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /\.eq\("venue_id", options\.venueId\)/);
  assert.match(readRepoFile("src/lib/services/types.ts"), /venueId\?: string;/);
});

test("detail-M8: stall and dish heroes are swipeable photo pagers with a full-screen view", () => {
  const pager = readRepoFile("src/components/dish/PhotoPager.tsx");

  assert.match(pager, /pagingEnabled/);
  assert.match(pager, /<Modal/);
  assert.match(pager, /\{index \+ 1\} \/ \{count\}/);
  assert.match(stall, /<PhotoPager/);
  assert.match(dish, /<PhotoPager/);
  // DISH-18: the dish hero holds the dish's own photos; review photos have their own rail.
  assert.match(dish, /buildDishHeroPhotos\(dish\)/);
});

test("detail-M10/L1/L19: reviews can be reported, blocked and open their author", () => {
  const actions = readRepoFile("src/components/review/ReviewReaderActions.tsx");

  // Owner decision (round 3): a heart like (stored as the helpful vote); hold it to report.
  assert.doesNotMatch(actions, /ThumbsUp|MoreHorizontal/);
  assert.match(actions, /setReviewHelpful/);
  assert.match(actions, /onLongPress=\{openSafetyActions\}/);
  assert.match(actions, /promptReviewSafetyActions/);
  assert.match(readRepoFile("src/components/review/index.ts"), /ReviewReaderActions/);
  for (const source of [stall, dish]) {
    assert.match(source, /<ReviewReaderActions/);
    assert.match(source, /navigation\.navigate\("UserProfile"/);
  }
  assert.match(
    readRepoFile("src/components/stall/PopularVisitorsSection.tsx"),
    /Picked by the owner/,
  );
});

test("detail-M11: 'Something wrong?' sends a catalog correction from both pages", () => {
  const link = readRepoFile("src/components/stall/ReportProblemLink.tsx");
  const page = readRepoFile("src/app/screens/detail/ReportProblemScreen.tsx");

  // The link opens its own page, which sends the report.
  assert.match(link, /navigation\.navigate\("ReportProblem", \{ venueId, dishId, subjectName \}\)/);
  assert.match(page, /submitCatalogCorrection\(\{/);
  assert.match(page, /note: note\.trim\(\)/);
  assert.match(stall, /<ReportProblemLink/);
  assert.match(dish, /<ReportProblemLink[\s\S]{0,120}dishId=\{dish\.id\}/);
  assert.match(readRepoFile("src/lib/services/types.ts"), /submitCatalogCorrection\(/);
  assert.match(
    readRepoFile("src/lib/services/supabase/supabaseService.ts"),
    /submit_catalog_correction/,
  );
  assert.match(
    readRepoFile("scripts/supabase-advisor-security-classifier.mjs"),
    /"submit_catalog_correction"/,
  );
});

test("detail-M12/M13/L16: delivery button text contrast, honest Follow label, non-interactive chips", () => {
  const brand = readRepoFile("src/constants/brandColors.ts");
  const follow = readRepoFile("src/components/stall/FollowStallButton.tsx");
  const chip = readRepoFile("src/components/ui/Chip.tsx");

  assert.match(brand, /BRAND_BUTTON_TEXT_COLORS/);
  assert.match(readRepoFile("src/components/dish/DeliveryPlatformButton.tsx"), /textColor/);
  assert.match(follow, /STALL_ALERTS_CAN_FIRE =/);
  assert.match(follow, /"Follow for menu updates" : "Follow"/);
  assert.match(chip, /onPress/);
});

test("detail-L4/L5/L21: events, side-load keys and dead prototype code", () => {
  assert.match(stall, /recordTap\("direction_tap"\)|"direction_tap"/);
  assert.match(stall, /"contact_tap"/);
  assert.match(stall, /"social_link_tap"/);
  assert.doesNotMatch(stall, /eventType: "promotion_profile_visit"/);
  assert.match(stall, /const sideLoadVenueId = venue\?\.id/);
  assert.doesNotMatch(stall, /reviewRepliesEnabled|activeReplyReviewId|submitReviewReply/);
});

test("detail-L6/L7/L10/L11: venue and dish reads map the new RPC columns", () => {
  const repo = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");
  const migration = readRepoFile("supabase/migrations/20261022050000_stall_dish_detail_reads.sql");

  assert.match(repo, /display_image_url/);
  assert.match(repo, /toVenueOpeningSchedule/);
  assert.match(repo, /toOptionalCoordinate/);
  assert.match(repo, /taste_confidence/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /grant execute on function public\.get_venue_detail\(text\) to anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_dish_detail\(text\) to anon, authenticated/,
  );
});

test("detail-L2/M14/M11 migrations keep their guards and have rolled-back smokes", () => {
  const pins = readRepoFile(
    "supabase/migrations/20261022050100_popular_visitor_pins_blocked_and_fresh.sql",
  );
  const push = readRepoFile(
    "supabase/migrations/20261022050200_stall_update_push_skips_drafts.sql",
  );
  const corrections = readRepoFile("supabase/migrations/20261022050300_catalog_corrections.sql");

  assert.match(pins, /as restrictive/);
  assert.match(pins, /app_private\.can_read_review\(review_id, author_profile_id\)/);
  assert.match(
    pins,
    /revoke all on function app_private\.refresh_popular_visitor_pins_for_review\(\)/,
  );
  assert.match(push, /if new\.merchant_draft then/);
  assert.match(
    push,
    /after insert or update of price, availability_flags, merchant_draft on public\.dishes/,
  );
  assert.match(corrections, /enable row level security/);
  assert.match(corrections, /security definer\s+set search_path = public, pg_temp/);
  assert.match(
    corrections,
    /revoke all on function public\.submit_catalog_correction\(text, text, text, text\) from public, anon/,
  );

  for (const smoke of [
    "stall_dish_detail_reads",
    "popular_visitor_pins_blocked_and_fresh",
    "stall_update_push_skips_drafts",
    "catalog_corrections",
  ]) {
    assert.match(readRepoFile(`supabase/smoke/${smoke}.sql`), /^rollback;/m, smoke);
  }
});

test("detail-L15/L22/L23: copy and dead ends", () => {
  const notFound = readRepoFile("src/app/screens/detail/NotFoundScreen.tsx");
  const offline = readRepoFile("src/app/screens/detail/OfflineStateScreen.tsx");
  const raw = readRepoFile("src/app/screens/catalog/CatalogRawDetailScreen.tsx");

  assert.doesNotMatch(notFound, /recipe/i);
  assert.match(notFound, /SearchResults/);
  assert.match(offline, /Content you already opened stays visible/);
  assert.doesNotMatch(offline, /queued|will be sent when/i);
  assert.match(raw, /goBackOrHome/);
  assert.match(raw, /Open stall page/);
  assert.match(dish, /<AppText variant="h2">Reviews<\/AppText>/);
  assert.match(stall, /<AppText variant="h2">Reviews<\/AppText>/);
});
