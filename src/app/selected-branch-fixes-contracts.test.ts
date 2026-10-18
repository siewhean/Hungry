import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("selected stale-branch fixes preserve FDO visuals while restoring behavior", () => {
  const wheelEntry = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const composer = read("src/app/screens/post/PostComposerScreen.tsx");
  const building = read("src/app/screens/discover/BuildingDrillDownScreen.tsx");

  assert.match(wheelEntry, /new Set<DietaryFlag>\(\)/);
  assert.doesNotMatch(wheelEntry, /dietaryFlags\.includes\(pref as any\)/);
  assert.match(review, /<StarRating[^>]*onChange=\{setRating\}[^>]*editable/);
  assert.match(composer, /<FeedErrorBoundary[\s\S]*screenName="PostComposerScreen"/);
  assert.match(building, /\[repository, tenantPolygons, venueById\]/);
});

test("animated FDO surfaces share the system and app reduced-motion preference", () => {
  const hook = read("src/hooks/useReduceMotion.ts");
  const animatedFiles = [
    "src/app/screens/home/StoryViewerScreen.tsx",
    "src/components/social/BiteCard.tsx",
    "src/components/social/ZoomableMedia.tsx",
    "src/components/gamification/CredEarnedToast.tsx",
    "src/components/gamification/FoodCredBadge.tsx",
    "src/components/gamification/PassportPageFlip.tsx",
    "src/components/gamification/PassportStampCard.tsx",
  ];

  assert.match(hook, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(hook, /reduceMotionChanged/);
  assert.match(hook, /reducedMotionEnabled/);
  for (const file of animatedFiles) {
    assert.match(read(file), /useReduceMotion/, `${file} must consume useReduceMotion`);
  }
});
