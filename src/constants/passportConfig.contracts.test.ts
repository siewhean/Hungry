import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_PASSPORT_CATEGORIES,
  PASSPORT_BADGE_DEFINITIONS,
  PASSPORT_STAMP_DEFINITIONS,
  computePassportProgress,
  createPassportCelebrateMarker,
  getEarnedPassportStamps,
  getNewlyEarnedUncelebratedStamp,
  getNextPassportStamp,
  isPassportBadgeEarned,
} from "./passportConfig";

test("passport stamp definitions are derived centrally from category thresholds", () => {
  const thresholdCount = ALL_PASSPORT_CATEGORIES.reduce(
    (sum, category) => sum + category.stampThresholds.length,
    0,
  );

  assert.equal(PASSPORT_STAMP_DEFINITIONS.length, thresholdCount);
  assert.equal(
    new Set(PASSPORT_STAMP_DEFINITIONS.map((stamp) => stamp.id)).size,
    PASSPORT_STAMP_DEFINITIONS.length,
  );
  assert.ok(PASSPORT_STAMP_DEFINITIONS.every((stamp) => stamp.assetKey));
  assert.ok(PASSPORT_STAMP_DEFINITIONS.every((stamp) => stamp.inkTone));
  assert.ok(PASSPORT_STAMP_DEFINITIONS.every((stamp) => stamp.stampShape));
  assert.equal(PASSPORT_BADGE_DEFINITIONS.length, 4);
  assert.equal(
    new Set(PASSPORT_BADGE_DEFINITIONS.map((badge) => badge.assetKey)).size,
    PASSPORT_BADGE_DEFINITIONS.length,
  );
});

test("passport selectors expose earned, next, and celebration-ready stamps", () => {
  const category = ALL_PASSPORT_CATEGORIES[0];
  const progressMap = {
    [category.id]: computePassportProgress(category, 3),
  };

  const earned = getEarnedPassportStamps(progressMap);
  const next = getNextPassportStamp(progressMap);
  const uncelebrated = getNewlyEarnedUncelebratedStamp(progressMap, {
    [earned[1].id]: true,
  });
  const marker = createPassportCelebrateMarker(uncelebrated);

  assert.equal(earned.length, 2);
  assert.equal(next?.stamp.threshold, 5);
  assert.equal(uncelebrated?.threshold, 3);
  assert.equal(marker?.stampId, uncelebrated?.id);
  assert.equal(marker?.shouldCelebrate, true);
});

test("passport badge unlocks require an explicit earned stamp source", () => {
  const category = ALL_PASSPORT_CATEGORIES[0];
  const earned = getEarnedPassportStamps({
    [category.id]: computePassportProgress(category, 1),
  });
  const contributorBadge = PASSPORT_BADGE_DEFINITIONS.find(
    (badge) => badge.id === "badge-contributor",
  );
  const sourcedBadge = PASSPORT_BADGE_DEFINITIONS.find(
    (badge) => badge.unlockCategoryId === category.id,
  );

  assert.ok(contributorBadge);
  assert.ok(sourcedBadge);
  assert.equal(isPassportBadgeEarned(contributorBadge, earned), false);
  assert.equal(isPassportBadgeEarned(sourcedBadge, earned), true);
});
