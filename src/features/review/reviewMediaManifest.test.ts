import assert from "node:assert/strict";
import test from "node:test";
import { dishes, userProfile } from "@/lib/services/mock/data";
import { buildReviewMediaManifest } from "./reviewMediaManifest";
const folder = `${userProfile.id}/review/attempt-version`;
const photos = dishes.slice(0, 2).map((dish) => dish.imageUrl);

test("lost upload acknowledgement recovers immutable object, preserving order and retry identity", async () => {
  const saved: { path: string }[] = [];
  let writes = 0;
  const input = {
    folder,
    photos,
    assertActive: () => {},
    listExisting: async () => [...saved],
    upload: async (path: string) => {
      writes += 1;
      saved.push({ path });
      if (writes === 1) throw new Error("lost acknowledgement");
      return { path };
    },
  };
  const manifest = await buildReviewMediaManifest(input);
  assert.deepEqual(
    manifest.map((entry) => entry.sortOrder),
    [0, 1],
  );
  assert.equal(writes, 2);
  assert.deepEqual(await buildReviewMediaManifest(input), manifest);
  assert.equal(writes, 2, "retry must never overwrite completed immutable objects");
});

test("partial failure reports exact photo and preserves completed assets", async () => {
  const saved: { path: string }[] = [];
  await assert.rejects(
    () =>
      buildReviewMediaManifest({
        folder,
        photos,
        assertActive: () => {},
        listExisting: async () => saved,
        upload: async (path) => {
          if (saved.length) throw new Error("offline");
          saved.push({ path });
          return { path };
        },
      }),
    /Photo 2 of 2.*preserved for retry/,
  );
  assert.equal(saved.length, 1);
});

test("account transition prevents publishing a recovered upload", async () => {
  let active = true;
  await assert.rejects(
    () =>
      buildReviewMediaManifest({
        folder,
        photos,
        assertActive: () => {
          if (!active) throw new Error("account changed");
        },
        listExisting: async () => [],
        upload: async (path) => {
          active = false;
          return { path };
        },
      }),
    /account changed/,
  );
});
