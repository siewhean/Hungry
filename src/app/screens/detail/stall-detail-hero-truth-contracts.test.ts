import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/app/screens/detail/StallDetailScreen.tsx"),
  "utf8",
);

test("stall detail hero never presents a dish image as source-backed stall media", () => {
  assert.match(source, /getStallHeroSelection\(\{/);
  assert.match(source, /venueImageUrl:\s*venue\?\.imageUrl/);
  assert.doesNotMatch(source, /source=\{\{\s*uri:\s*leadDish\?\.imageUrl\s*\}\}/);
  assert.doesNotMatch(source, /imageUrl:\s*leadDish\?\.imageUrl/);
});

test("stall detail discloses and recovers to its representative hero", () => {
  assert.match(source, /getDishFallbackImageSource\(heroFallbackSource\)/);
  assert.match(source, /setVenueHeroFailed\(true\)/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /representative hero image/);
});

test("stall detail allows the full venue name to wrap in its identity card", () => {
  assert.match(
    source,
    /<AppText variant="h2" numberOfLines=\{2\} style=\{\{ flexShrink: 1 \}\}>\s*\{venue\.name\}/,
  );
});
