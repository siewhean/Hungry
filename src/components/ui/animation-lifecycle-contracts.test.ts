import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("native loading and idle animations stop during teardown", () => {
  const skeleton = read("src/components/ui/Skeleton.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");

  assert.match(skeleton, /const animation = Animated\.loop\(/);
  assert.match(skeleton, /return \(\) => \{\s*animation\.stop\(\);\s*opacity\.stopAnimation\(\);/);
  // The idle pulse was never bound to a view; it is removed rather than torn down.
  assert.doesNotMatch(discover, /pulseAnim|idleTimerRef|resetIdleTimer/);
});
