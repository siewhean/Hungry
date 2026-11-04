import assert from "node:assert/strict";
import test from "node:test";

import {
  getSentimentStats,
  isRatingFilter,
  matchesRatingFilter,
} from "@/features/merchant/inboxFilters";

test("rating filters match their star bands only", () => {
  assert.equal(matchesRatingFilter({ rating: 1 }, "rating_low"), true);
  assert.equal(matchesRatingFilter({ rating: 2 }, "rating_low"), true);
  assert.equal(matchesRatingFilter({ rating: 3 }, "rating_low"), false);
  assert.equal(matchesRatingFilter({ rating: 3 }, "rating_mid"), true);
  assert.equal(matchesRatingFilter({ rating: 4 }, "rating_high"), true);
  assert.equal(matchesRatingFilter({ rating: 5 }, "rating_high"), true);
  assert.equal(matchesRatingFilter({ rating: 5 }, "rating_mid"), false);
});

test("a review without stars is in no rating band", () => {
  for (const filter of ["rating_low", "rating_mid", "rating_high"] as const) {
    assert.equal(matchesRatingFilter({ rating: undefined }, filter), false);
  }
});

test("isRatingFilter tells rating chips from the other chips", () => {
  assert.equal(isRatingFilter("rating_low"), true);
  assert.equal(isRatingFilter("unreplied"), false);
  assert.equal(isRatingFilter("all"), false);
});

test("sentiment counts rated reviews only, so unrated ones are not called neutral", () => {
  const stats = getSentimentStats([
    { rating: 5 },
    { rating: 4 },
    { rating: 3 },
    { rating: 1 },
    { rating: undefined },
    { rating: 0 },
  ]);
  assert.deepEqual(stats, { total: 4, positive: 50, neutral: 25, negative: 25 });
});

test("no rated reviews means no summary", () => {
  assert.equal(getSentimentStats([]), null);
  assert.equal(getSentimentStats([{ rating: undefined }]), null);
});
