import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("core-only builds keep detail controls read-only despite targeted feature opt-ins", () => {
  for (const appEnv of ["staging", "production"] as const) {
    const flags = resolveFeatureFlags(appEnv, "production", {
      EXPO_PUBLIC_RELEASE_01_CORE_ONLY: "1",
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
  // Tried and Save are added to the bottom bar, and Share to the header, only when deferred controls are on.
  assert.match(
    dish,
    /const barActions: DetailAction\[\] = showDeferredDetailControls\s*\? \[[\s\S]*?accessibilityLabel: "Tried"/,
  );
  assert.match(dish, /onShare=\{showDeferredDetailControls \? openShareSheet : undefined\}/);
  assert.doesNotMatch(dish, /id: "like"/);
  assert.match(dish, /\{showDeferredDetailControls \? \([\s\S]*?<ReviewShareSheet/);
  assert.match(
    dish,
    /showDeferredDetailControls\s*\? "Be the first to add one\."\s*: "Reviews from diners will appear here when available\."/,
  );

  assert.match(stall, /const showDeferredDetailControls = !FEATURE_FLAGS\.release01CoreOnly/);
  assert.match(stall, /showVisited=\{showDeferredDetailControls && isAuthenticated\}/);
  assert.match(stall, /showDeferredDetailControls && FEATURE_FLAGS\.portfoliosEnabled/);
  assert.match(
    stall,
    /showDeferredDetailControls && FEATURE_FLAGS\.reviewCreationEnabled\s*\? openWriteReview/,
  );
  assert.match(
    stall,
    /\{showDeferredDetailControls && FEATURE_FLAGS\.merchantClaimCtaEnabled \? \(/,
  );
  // Reviews show whenever detail controls do; only writing one needs reviewCreationEnabled.
  assert.match(
    stall,
    /\{showDeferredDetailControls && !stallIsEmpty \? \(\s*<View onLayout=\{handleReviewsSectionLayout\} style=\{\{ gap: spacing\[4\] \}\}>\s*<AppText variant="h2">Reviews<\/AppText>/,
  );
  assert.match(
    stall,
    /FEATURE_FLAGS\.reviewCreationEnabled\s*\? \{ ctaLabel: "Write a review", onPress: openWriteReview \}/,
  );
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
    // The stall's neutral state lives in its hero fallback component.
    assert.match(
      file.includes("Stall")
        ? `${source}${read("src/components/stall/StallHeroFallback.tsx")}`
        : source,
      /photo unavailable/,
    );
  }
});
