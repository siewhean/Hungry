import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeCatalogImageUrl, sanitizeCatalogMediaUrl } from "./media";

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
    sanitizeCatalogImageUrl("http://cdn.example.com/stall.jpg"),
    "http://cdn.example.com/stall.jpg",
  );
});
