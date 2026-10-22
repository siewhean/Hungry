import assert from "node:assert/strict";
import test from "node:test";
import { hungryService } from "@/lib/services/mock/mockService";
import { buildMyDataExport } from "./exportMyData";

test("data export explicitly records a failed section while preserving readable sections", async () => {
  const result = await buildMyDataExport({
    ...hungryService,
    social: {
      ...hungryService.social,
      listFollowers: async () => {
        throw new Error("Followers unavailable");
      },
    },
  });
  assert.equal(result.followers.ok, false);
  if (!result.followers.ok) assert.equal(result.followers.error, "Followers unavailable");
  assert.equal(result.reviews.ok, true);
  assert.equal(result.following.ok, true);
  assert.ok(result.profile.id);
  assert.equal(result.exportVersion, 1);
});

test("export aborts if account identity cannot be read", async () => {
  await assert.rejects(
    () =>
      buildMyDataExport({
        ...hungryService,
        profile: {
          ...hungryService.profile,
          getProfile: async () => {
            throw new Error("Account unavailable");
          },
        },
      }),
    /Account unavailable/,
  );
});
