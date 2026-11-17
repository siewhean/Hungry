import assert from "node:assert/strict";
import { test } from "node:test";

import { dishes, stallPosts } from "./data";

test("Salmon Don has its own photo, not the fish soup photo", () => {
  const salmonDon = dishes.find((dish) => dish.id === "dish-salmon-don");
  const fishSoup = dishes.find((dish) => dish.id === "dish-fish-soup");
  assert.ok(salmonDon && fishSoup);
  assert.match(salmonDon.imageUrl ?? "", /sushi-set-topdown/);
  assert.match(fishSoup.imageUrl ?? "", /fish-soup-topdown/);
  assert.notEqual(salmonDon.imageUrl, fishSoup.imageUrl);
  for (const post of stallPosts.filter((p) => p.dishIds?.includes("dish-fish-soup"))) {
    assert.ok(!post.mediaUrls?.includes(salmonDon.imageUrl ?? ""), post.id);
  }
});
