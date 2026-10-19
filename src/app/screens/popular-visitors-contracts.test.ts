import test from "node:test";

import { assertSourceExcludes, assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

test("stall detail surfaces merchant-pinned popular visitors from services", () => {
  const section = readRepoFile("src/components/stall/PopularVisitorsSection.tsx");
  const stallDetail = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");

  assertSourceIncludes(
    section,
    [
      /content\.listPopularVisitorPinsByVenue\(venueId\)/,
      /pins\.slice\(0, 6\)\.map/,
      /navigation\.navigate\("UserProfile"/,
      /label="View profile"/,
      /label="View review"/,
      /reviewSheetRef\.current\?\.present\(\)/,
    ],
    "PopularVisitorsSection",
  );
  assertSourceExcludes(
    section,
    [/Sarah L\./, /Joshua T\./, /popularVisitorPins/, /merchantCustomerInteractions/],
    "PopularVisitorsSection hardcoded visitors",
  );
  assertSourceIncludes(
    stallDetail,
    [/PopularVisitorsSection/, /<PopularVisitorsSection venueId=\{venue\.id\}/],
    "stall detail popular visitors",
  );
});

test("merchant FeaturedVisitors screen manages review-backed pins through service methods", () => {
  const screen = readRepoFile("src/app/screens/merchant/FeaturedVisitorsScreen.tsx");
  const types = readRepoFile("src/lib/services/types.ts");
  const mockService = readRepoFile("src/lib/services/mock/mockService.ts");
  const supabaseService = readRepoFile("src/lib/services/supabase/supabaseService.ts");

  assertSourceIncludes(
    screen,
    [
      /merchant\.listPopularVisitorPins\(activeOutlet\.id\)/,
      /merchant\.listPopularVisitorCandidates\(activeOutlet\.id\)/,
      /merchant\.pinPopularVisitor\(\s*activeOutlet\.id,\s*candidate\.reviewId,?\s*\)/,
      /merchant\.unpinPopularVisitor\(pinId\)/,
      /merchant\.reorderPopularVisitorPins\(/,
      /pins\.length >= 6/,
      /setPins\(previousPins\)/,
      /setError\(caughtError instanceof Error \? caughtError\.message : "Unable to pin visitor\."\)/,
    ],
    "FeaturedVisitorsScreen",
  );
  assertSourceIncludes(
    types,
    [
      /listPopularVisitorCandidates\(outletId: string\): Promise<PopularVisitorCandidate\[\]>/,
      /listPopularVisitorPins\(outletId: string\): Promise<PopularVisitorPin\[\]>/,
      /pinPopularVisitor\(outletId: string, reviewId: string\): Promise<PopularVisitorPin>/,
      /unpinPopularVisitor\(pinId: string\): Promise<void>/,
      /reorderPopularVisitorPins\(/,
      /listPopularVisitorPinsByVenue\(venueId: string\): Promise<PopularVisitorPin\[\]>/,
    ],
    "popular visitor service contract",
  );
  assertSourceIncludes(
    mockService,
    [
      /getReviewBackedVisitorCandidates/,
      /listActivePopularVisitorPins/,
      /if \(activePins\.length >= 6\)/,
      /sortPopularVisitorPins/,
    ],
    "mock popular visitor service",
  );
  assertSourceIncludes(
    supabaseService,
    [
      /merchant_popular_visitor_pins/,
      /requireLinkedMerchantOutlet\(client, outletId\)/,
      /public_profiles/,
      /safeProfileId/,
      /onConflict: "outlet_id,review_id"/,
      /failedUpdate\?\.error/,
    ],
    "Supabase popular visitor service",
  );
});
