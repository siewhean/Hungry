import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("released environments keep detail controls read-only despite targeted feature opt-ins", () => {
  for (const appEnv of ["staging", "production"] as const) {
    const flags = resolveFeatureFlags(appEnv, "production", {
      EXPO_PUBLIC_ENABLE_REVIEWS: "1",
      EXPO_PUBLIC_ENABLE_SOCIAL_FEED: "1",
    });

    assert.equal(flags.release01CoreOnly, true, `${appEnv} must retain the Release 0.1 profile`);
    assert.equal(flags.reviewCreationEnabled, true, "test must prove screen-level release gating");
    assert.equal(flags.socialFeedEnabled, true, "test must prove screen-level release gating");
  }

  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(dish, /const showDeferredDetailControls = !FEATURE_FLAGS\.release01CoreOnly/);
  assert.match(
    dish,
    /\{showDeferredDetailControls \? \([\s\S]*?accessibilityLabel="Mark this food as tried"/,
  );
  assert.match(
    dish,
    /\{showDeferredDetailControls \? \([\s\S]*?accessibilityLabel=\{`Share \$\{dish\.name\}`\}/,
  );
  assert.match(dish, /\{showDeferredDetailControls \? \([\s\S]*?<ReviewShareSheet/);
  assert.match(
    dish,
    /showDeferredDetailControls\s*\? "Be the first to add one\."\s*: "Reviews from diners will appear here when available\."/,
  );

  assert.match(stall, /const showDeferredDetailControls = !FEATURE_FLAGS\.release01CoreOnly/);
  assert.match(stall, /\{showDeferredDetailControls && isAuthenticated && venue \? \(/);
  assert.match(stall, /\{showDeferredDetailControls && FEATURE_FLAGS\.collectionsEnabled \? \(/);
  assert.match(
    stall,
    /\{showDeferredDetailControls && FEATURE_FLAGS\.merchantClaimCtaEnabled \? \(/,
  );
  assert.match(stall, /\{showDeferredDetailControls && FEATURE_FLAGS\.reviewCreationEnabled \? \(/);
  assert.match(stall, /if \(!showDeferredDetailControls\) \{[\s\S]*?setActivePromotions\(\[\]\)/);
  assert.match(stall, /\{showDeferredDetailControls \? \([\s\S]*?<ReviewShareSheet/);
});

test("detail catalog images use the shared sanitizer and provide neutral unavailable states", () => {
  for (const file of [
    "src/app/screens/detail/DishDetailScreenV2.tsx",
    "src/app/screens/detail/StallDetailScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /sanitizeCatalogImageUrl/);
    assert.match(source, /photo unavailable/);
  }
});
