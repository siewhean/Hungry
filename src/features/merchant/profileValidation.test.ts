import assert from "node:assert/strict";
import test from "node:test";

import { validateMerchantProfileUpdates } from "./profileValidation";

test("validateMerchantProfileUpdates trims and normalizes string fields", () => {
  const result = validateMerchantProfileUpdates({
    name: "  Uncle Tan's Wonton Mee  ",
    cuisineCategories: ["  Chinese  ", " Noodles ", ""],
    tasteTags: [" Savoury ", " Springy "],
  });

  assert.equal(result.name, "Uncle Tan's Wonton Mee");
  assert.deepEqual(result.cuisineCategories, ["Chinese", "Noodles"]);
  assert.deepEqual(result.tasteTags, ["Savoury", "Springy"]);
});

test("validateMerchantProfileUpdates rejects invalid contact fields", () => {
  assert.throws(
    () =>
      validateMerchantProfileUpdates({
        contactEmail: "invalid-email-format",
      }),
    /Contact email format is invalid/,
  );

  assert.throws(
    () =>
      validateMerchantProfileUpdates({
        contactPhone: "abcde",
      }),
    /Contact phone format is invalid/,
  );
});

test("validateMerchantProfileUpdates rejects exact privacy for home-based businesses", () => {
  assert.throws(
    () =>
      validateMerchantProfileUpdates({
        businessType: "home_based",
        locationPrivacy: "exact",
      }),
    /Home-based businesses cannot use exact location privacy/,
  );
});
