import assert from "node:assert/strict";
import test from "node:test";

import { getDiscoverAreaCountLabel } from "./areaCount";

test("area count is hidden until the feed loads", () => {
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: false,
      feedVenueCount: 0,
      feedLimit: 100,
      rpcCount: 12,
    }),
    null,
  );
});

test("area count matches the list while the feed is under its limit", () => {
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: true,
      feedVenueCount: 7,
      feedLimit: 100,
      rpcCount: 0,
    }),
    "7",
  );
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: true,
      feedVenueCount: 0,
      feedLimit: 100,
      rpcCount: 340,
    }),
    "0",
  );
});

test("a full feed uses the separate count only when it is not smaller than the list", () => {
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: true,
      feedVenueCount: 100,
      feedLimit: 100,
      rpcCount: 240,
    }),
    "240",
  );
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: true,
      feedVenueCount: 100,
      feedLimit: 100,
      rpcCount: 3,
    }),
    "100+",
  );
  assert.equal(
    getDiscoverAreaCountLabel({
      isFeedLoaded: true,
      feedVenueCount: 100,
      feedLimit: 100,
      rpcCount: null,
    }),
    "100+",
  );
});
