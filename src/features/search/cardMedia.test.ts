import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { availableCardImages } from "./cardMedia";

test("failed gallery images retain the source index of the surviving image", () => {
  const images = Array.from(new Set(dishes.map((dish) => dish.imageUrl))).slice(0, 3);
  assert.equal(images.length, 3);
  const survivors = availableCardImages(images, [images[0]]);
  assert.deepEqual(
    survivors.map((image) => image.originalIndex),
    [1, 2],
  );
  assert.equal(survivors[0].url, images[1]);
});
test("a failed gallery never substitutes unrelated media", () => {
  const images = [dishes[0].imageUrl];
  assert.deepEqual(availableCardImages(images, images), []);
});
