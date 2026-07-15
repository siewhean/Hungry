import assert from "node:assert/strict";
import test from "node:test";

import { getDishHeroSelection } from "@/features/detail/dishHeroPresentation";

const baseDish = {
  cuisineTags: ["Local"],
  foodTypeTag: "chicken rice",
  gallery: [] as string[],
  imageUrl: "",
  name: "Chicken Rice",
  venueName: "Example Stall",
};

test("dish hero accepts the first usable source-backed gallery URL", () => {
  assert.deepEqual(
    getDishHeroSelection({
      ...baseDish,
      gallery: ["https://cdn.example/chicken-rice.jpg"],
      imageUrl: "https://cdn.example/second.jpg",
    }),
    {
      kind: "dish",
      imageUrl: "https://cdn.example/chicken-rice.jpg",
    },
  );
});

test("dish hero rejects blocked and malformed URLs in favour of disclosed representative media", () => {
  for (const imageUrl of [
    "https://images.unsplash.com/photo-placeholder",
    "not-a-url",
    "https://cdn.example/one.jpg,https://cdn.example/two.jpg",
  ]) {
    assert.deepEqual(getDishHeroSelection({ ...baseDish, imageUrl }), {
      kind: "representative",
      fallbackKey: "chicken-rice",
    });
  }
});
