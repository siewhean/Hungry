import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Round six audit (2026-11-04): small fixes that are about how a file is written, not what a
// render shows. The render and unit tests cover the behaviour; these keep the details in place.

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("stall page: Call, rating, Directions and Opening hours reach a 44pt target", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  // The Directions line is 26pt tall: 10pt above and below.
  assert.match(
    stall,
    /onPress=\{openStallMaps\}[\s\S]{0,160}hitSlop=\{\{ bottom: 10, top: 10 \}\}/,
  );
  // The Call and rating chips are 32pt: 6pt above and below.
  assert.match(
    stall,
    /openMerchantContact\("phone"[\s\S]{0,200}hitSlop=\{\{ bottom: 6, top: 6 \}\}/,
  );
  assert.match(stall, /onPress=\{scrollToReviews\}\s*hitSlop=\{\{ bottom: 6, top: 6 \}\}/);
  assert.match(
    stall,
    /onPress=\{\(\) => setHoursExpanded\(\(open\) => !open\)\}\s*hitSlop=\{\{ bottom: 10, top: 10 \}\}/,
  );
});

test("small buttons, the Profile settings button and the search launcher reach 44pt", () => {
  assert.match(read("src/components/ui/Button.tsx"), /hitSlop=\{size === "sm" \? 4 : undefined\}/);
  // The caller's own hitSlop still wins: the spread comes after the default.
  assert.match(
    read("src/components/ui/Button.tsx"),
    /hitSlop=\{size === "sm" \? 4 : undefined\}\s*\{\.\.\.props\}/,
  );
  assert.match(read("src/components/ui/ExpandableSearchLauncher.tsx"), /hitSlop=\{2\}/);
  assert.match(
    read("src/app/screens/profile/ProfileHomeScreen.tsx"),
    /navigation\.navigate\("Settings"\)\}[\s\S]{0,120}hitSlop=\{2\}/,
  );
});

test("the promotion card's two badges share one wrapping row", () => {
  const card = read("src/components/promotion/CustomerPromotionCard.tsx");
  assert.match(
    card,
    /flexDirection: "row", flexWrap: "wrap", gap: spacing\[2\] \}\}\s*>\s*<Badge label="Promotion"/,
  );
});

test("no typed × or ★ glyphs: symbols instead", () => {
  const results = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.doesNotMatch(results, /×/);
  assert.match(results, /rightIcon=\{<AppSymbol name="close"/);
  const preview = read("src/features/post/components/LivePreviewSheet.tsx");
  assert.doesNotMatch(preview, /★/);
  assert.match(preview, /accessibilityLabel=\{`Rated \$\{rating\} out of 5`\}/);
});

test("every review card uses the one Helpful vote, and stall cards put the stars under the name", () => {
  const actions = read("src/components/review/ReviewReaderActions.tsx");
  assert.doesNotMatch(actions, /variant\?: "heart"|Like, /);
  const stallCard = read("src/components/stall/StallReviewCard.tsx");
  const name = stallCard.indexOf("{review.authorName}");
  const stars = stallCard.indexOf("<ReviewStars rating={review.rating} />");
  const text = stallCard.indexOf("<CaptionPreview");
  assert.ok(name > 0 && stars > name && text > stars, "name, then stars, then the words");
  const footer = stallCard.slice(stallCard.indexOf("<ReviewReaderActions"));
  assert.doesNotMatch(footer, /rating=\{review\.rating\}/, "no second row of stars in the footer");
});

test("the review share sheet reports what it catches", () => {
  const sheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  assert.match(
    sheet,
    /reportError\(error, \{ screen: "ReviewShareSheet", action: "list_conversations" \}\)/,
  );
  assert.match(
    sheet,
    /reportError\(error, \{ screen: "ReviewShareSheet", action: "share_to_chat" \}\)/,
  );
});
