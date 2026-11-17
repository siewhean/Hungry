import assert from "node:assert/strict";
import test from "node:test";

import { getHomeBitesFeed } from "@/features/home/bites";

test("getHomeBitesFeed returns canonical service bites sorted by recency", async () => {
  const bites = await getHomeBitesFeed();

  assert.ok(bites.length > 0);
  assert.ok(
    bites.every(
      (bite) =>
        typeof bite.id === "string" &&
        typeof bite.dishId === "string" &&
        typeof bite.photoUrl === "string" &&
        typeof bite.cravingCount === "number",
    ),
  );

  for (let i = 1; i < bites.length; i += 1) {
    const previousTimestamp = new Date(bites[i - 1].createdAt).getTime();
    const currentTimestamp = new Date(bites[i].createdAt).getTime();
    assert.ok(previousTimestamp >= currentTimestamp);
  }
});
