import assert from "node:assert/strict";
import test from "node:test";

import {
  SERVER_FILTERED_CARD_IMAGE_RPCS,
  sanitizeCatalogCardImageUrl,
  sanitizeCatalogImageUrl,
  sanitizeCatalogMediaUrl,
  sanitizeOfflineCatalogImageUrl,
} from "./media";

test("catalog image mapping rejects blocked, malformed, and withheld media", () => {
  assert.equal(sanitizeCatalogImageUrl("https://images.unsplash.com/photo-1"), undefined);
  assert.equal(sanitizeCatalogImageUrl("javascript:alert(1)"), undefined);
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", "approved", false),
    undefined,
  );
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", "restricted", true),
    undefined,
  );
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", "unverified", true),
    undefined,
  );
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", undefined, true),
    undefined,
  );
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", "approved", undefined),
    undefined,
  );
  assert.equal(
    sanitizeCatalogMediaUrl(
      "https://food.grab.com/static/images/social-hero-SG.jpg",
      "permitted_api",
      true,
    ),
    undefined,
  );
});

test("catalog image mapping retains a valid allowed image", () => {
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/dish.jpg", "approved", true),
    "https://cdn.example.com/dish.jpg",
  );
  assert.equal(
    sanitizeCatalogMediaUrl("https://cdn.example.com/merchant.jpg", "merchant_owned", true),
    "https://cdn.example.com/merchant.jpg",
  );
  assert.equal(
    sanitizeCatalogImageUrl("http://cdn.example.com/stall.jpg"),
    "http://cdn.example.com/stall.jpg",
  );
});

test("card images: only the server-filtered RPCs are trusted without a display flag", () => {
  const url = "https://cdn.example.com/dish.jpg";
  for (const rpc of SERVER_FILTERED_CARD_IMAGE_RPCS) {
    assert.equal(sanitizeCatalogCardImageUrl(url, rpc, { rightsStatus: "unverified" }), url, rpc);
    assert.equal(
      sanitizeCatalogCardImageUrl(url, rpc, { approvedForDisplay: false }),
      undefined,
      `${rpc}: an explicit false still hides`,
    );
    assert.equal(
      sanitizeCatalogCardImageUrl(url, rpc, { rightsStatus: "rejected" }),
      undefined,
      `${rpc}: a withheld rights status still hides`,
    );
  }
  // Any other source (a new RPC, the gallery table, a fallback) keeps the strict rule.
  assert.equal(sanitizeCatalogCardImageUrl(url, "catalog_raw_map_view", {}), undefined);
  assert.equal(
    sanitizeCatalogCardImageUrl(url, "catalog_raw_map_view", {
      rightsStatus: "merchant_owned",
      approvedForDisplay: true,
    }),
    url,
  );
});

test("offline catalog images: delivery-app photos are dropped, first-party photos stay", () => {
  for (const url of [
    "https://food-cms.grab.com/compressed_webp/items/abc.webp",
    "https://huawei-food-cms.grab.com/items/abc.jpg",
    "https://food.grab.com/sg/en/restaurant/x",
    "https://images.deliveroo.com/x.jpg",
    "https://images.foodpanda.sg/x.jpg",
  ]) {
    assert.equal(sanitizeOfflineCatalogImageUrl(url), undefined, url);
  }
  assert.equal(
    sanitizeOfflineCatalogImageUrl("https://www.yakun.com/menu/kaya-toast.jpg"),
    "https://www.yakun.com/menu/kaya-toast.jpg",
  );
  assert.equal(sanitizeOfflineCatalogImageUrl("https://images.unsplash.com/photo-1"), undefined);
});
