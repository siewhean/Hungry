import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("native loading and idle animations stop during teardown", () => {
  const skeleton = read("src/components/ui/Skeleton.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");

  // One shared sweep clock: it starts with the first skeleton and stops when the last one unmounts.
  assert.match(skeleton, /const animation = Animated\.loop\(/);
  assert.match(skeleton, /useNativeDriver: true/);
  assert.match(
    skeleton,
    /mountedSkeletons === 0 && sweepAnimation\) \{\s*sweepAnimation\.stop\(\);/,
  );
  assert.match(skeleton, /return retainSweepClock\(motion\.skeleton\)/);
  // The idle pulse was never bound to a view; it is removed rather than torn down.
  assert.doesNotMatch(discover, /pulseAnim|idleTimerRef|resetIdleTimer/);
});
