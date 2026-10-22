import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { reviewAttemptPayload } from "./reviewPublication";

test("immutable attempts change when bytes change at the same local URI", async () => {
  const dish = dishes[0];
  const draft = {
    dishId: dish.id,
    venueId: dish.venueId,
    rating: dish.rating,
    text: "",
    tags: dish.tasteTags,
    photos: [dish.imageUrl],
  };
  const original = await reviewAttemptPayload(draft, async () => "first-content-digest");
  assert.equal(original, await reviewAttemptPayload(draft, async () => "first-content-digest"));
  assert.notEqual(
    original,
    await reviewAttemptPayload(draft, async () => "changed-content-digest"),
  );
});
