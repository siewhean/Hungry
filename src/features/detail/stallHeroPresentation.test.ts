import assert from "node:assert/strict";
import test from "node:test";

import { getStallHeroSelection } from "./stallHeroPresentation";

test("stall hero prefers an allowed venue/storefront image", () => {
  assert.deepEqual(
    getStallHeroSelection({
      venueImageUrl: "  https://cdn.example.com/han-kee-storefront.jpg  ",
      fallback: { name: "Sliced Fish Ban Mian", venueName: "Han Kee Fish Soup" },
    }),
    {
      kind: "venue",
      imageUrl: "https://cdn.example.com/han-kee-storefront.jpg",
    },
  );
});

test("stall hero rejects blocked image hosts and requires a disclosed representative fallback", () => {
  assert.deepEqual(
    getStallHeroSelection({
      venueImageUrl: "https://images.unsplash.com/photo-unrelated-salad",
      fallback: {
        foodTypeTag: "ban mian",
        name: "Sliced Fish Ban Mian",
        venueName: "Han Kee Fish Soup",
      },
    }),
    {
      kind: "representative",
      fallbackKey: "bak-chor-mee",
    },
  );
});

test("stall hero uses venue identity to choose a representative when no dish is loaded", () => {
  assert.deepEqual(
    getStallHeroSelection({
      fallback: { name: "Han Kee Fish Soup", venueName: "Han Kee Fish Soup" },
    }),
    {
      kind: "representative",
      fallbackKey: "fish-soup",
    },
  );
});
