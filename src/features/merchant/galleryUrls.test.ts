import assert from "node:assert/strict";
import test from "node:test";

import { nextGalleryUrls } from "@/features/merchant/galleryUrls";

const previous = {
  profilePhotoUrl: "p-old",
  coverPhotoUrl: "c-old",
  galleryUrls: ["p-old", "c-old", "extra"],
};

test("nothing replaced keeps the gallery as it was", () => {
  assert.deepEqual(
    nextGalleryUrls(previous, { profilePhotoUrl: "p-old", coverPhotoUrl: "c-old" }),
    ["p-old", "c-old", "extra"],
  );
});

test("a replaced profile photo leaves the gallery with the new one, not both", () => {
  assert.deepEqual(
    nextGalleryUrls(previous, { profilePhotoUrl: "p-new", coverPhotoUrl: "c-old" }),
    ["p-new", "c-old", "extra"],
  );
});

test("a replaced cover photo is dropped too, and extra gallery photos stay", () => {
  assert.deepEqual(
    nextGalleryUrls(previous, { profilePhotoUrl: "p-old", coverPhotoUrl: "c-new" }),
    ["p-old", "c-new", "extra"],
  );
});

test("a first photo is added, and removing a photo drops it from the gallery", () => {
  const empty = { galleryUrls: [] as string[] };
  assert.deepEqual(nextGalleryUrls(empty, { profilePhotoUrl: "p", coverPhotoUrl: "" }), ["p"]);
  assert.deepEqual(nextGalleryUrls(previous, { profilePhotoUrl: "", coverPhotoUrl: "c-old" }), [
    "c-old",
    "extra",
  ]);
});
