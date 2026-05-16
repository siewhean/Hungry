import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("passport visuals use orange Hungry theme and cached image assets", () => {
  const cover = read("src/components/gamification/PassportCover.tsx");
  const badge = read("src/components/gamification/PassportBadgeImage.tsx");
  const stamp = read("src/components/gamification/PassportStampBadge.tsx");
  const assets = read("src/components/gamification/passportAssets.ts");

  assert.match(cover, /backgroundColor: palette\.orange/);
  assert.match(cover, /borderColor: palette\.orangeDark/);
  assert.match(cover, /PASSPORT_TEXTURE_ASSETS\.cover/);
  assert.match(badge, /cachePolicy="memory-disk"/);
  assert.match(stamp, /cachePolicy="memory-disk"/);
  assert.match(assets, /passport-cover-orange\.png/);
  assert.match(assets, /passport-paper-spread\.png/);
});

test("passport generated image files exist in the project asset folder", () => {
  const files = [
    "passport-cover-orange.png",
    "passport-paper-spread.png",
    "stamp-cuisine-hawker.png",
    "stamp-classic-laksa.png",
    "stamp-hood-chinatown.png",
    "stamp-dietary-halal.png",
    "badge-hawker-explorer.png",
    "badge-classics-trail.png",
    "badge-night-makan.png",
    "badge-contributor.png",
  ];

  for (const file of files) {
    const assetPath = resolve(process.cwd(), "src/assets/gamification/passport", file);
    assert.equal(existsSync(assetPath), true, `${file} should exist`);
    const bytes = readFileSync(assetPath);
    assert.equal(bytes.subarray(1, 4).toString("utf8"), "PNG", `${file} should be a PNG`);
  }
});

test("passport art is generated as bitmap assets, not SVG placeholders", () => {
  const generator = read("scripts/generate-passport-assets.mjs");
  const stamp = read("src/components/gamification/PassportStampBadge.tsx");

  assert.match(generator, /from "pngjs"/);
  assert.match(generator, /passport-cover-orange\.png/);
  assert.match(generator, /stamp-cuisine-hawker\.png/);
  assert.doesNotMatch(generator, /<svg/i);
  assert.doesNotMatch(stamp, /lucide-react-native/);
  assert.match(stamp, /contentFit="contain"/);
});

test("passport screen announces and marks one-time stamp celebrations", () => {
  const screen = read("src/app/screens/profile/PassportScreen.tsx");

  assert.match(screen, /AccessibilityInfo\.announceForAccessibility/);
  assert.match(screen, /Achievement stamped:/);
  assert.match(screen, /markStampCelebrated\(celebrateMarker\.stampId\)/);
  assert.match(screen, /reduceMotion/);
  assert.match(screen, /PassportPageFlip/);
});
