import assert from "node:assert/strict";
import test from "node:test";

import { buildSetupChecklist, SETUP_MIN_DISHES } from "@/features/merchant/setupChecklist";
import type { MerchantOutlet } from "@/types/domain";

function outlet(overrides: Partial<MerchantOutlet> = {}): MerchantOutlet {
  return {
    id: "o1",
    merchantAccountId: "a1",
    name: "Uncle Tan",
    businessType: "hawker_stall",
    locationPrivacy: "exact",
    description: "",
    cuisineCategories: [],
    operatingHours: "",
    galleryUrls: [],
    socialLinks: [],
    deliveryLinks: [],
    dietaryLabels: [],
    tasteTags: [],
    signatureDishIds: [],
    isLive: false,
    verification: { status: "not_started", evidence: [] },
    ...overrides,
  } as MerchantOutlet;
}

test("a brand new outlet has nothing done, in the order verify, dishes, hours, photo", () => {
  const { items, doneCount } = buildSetupChecklist(outlet(), 0);
  assert.deepEqual(
    items.map((item) => [item.id, item.done]),
    [
      ["verify", false],
      ["dishes", false],
      ["hours", false],
      ["photo", false],
    ],
  );
  assert.equal(doneCount, 0);
  assert.equal(items[1].detail, `0 of ${SETUP_MIN_DISHES} added`);
});

test("sending the licence counts as done, and the detail says Hungry is reviewing it", () => {
  const { items } = buildSetupChecklist(
    outlet({ verification: { status: "in_review", evidence: [] } as never }),
    0,
  );
  assert.equal(items[0].done, true);
  assert.match(items[0].detail, /reviewing/);
});

test("five dishes finish the dish step, and the count never reads past five", () => {
  const { items } = buildSetupChecklist(outlet(), 8);
  assert.equal(items[1].done, true);
  assert.equal(items[1].detail, "5 of 5 added");
});

test("hours and a photo (logo or cover) finish their steps", () => {
  const { items, doneCount } = buildSetupChecklist(
    outlet({ operatingHours: "7am - 3pm", coverPhotoUrl: "https://cdn.example.sg/c.jpg" }),
    0,
  );
  assert.equal(items.find((item) => item.id === "hours")?.done, true);
  assert.equal(items.find((item) => item.id === "photo")?.done, true);
  assert.equal(doneCount, 2);
});

test("a verified outlet with everything set is four of four", () => {
  const { doneCount } = buildSetupChecklist(
    outlet({
      operatingHours: "7am - 3pm",
      profilePhotoUrl: "https://cdn.example.sg/p.jpg",
      verification: { status: "verified", evidence: [] } as never,
    }),
    5,
  );
  assert.equal(doneCount, 4);
});
