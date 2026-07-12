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
  assert.match(
    discover,
    /useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(idleTimerRef\.current\) clearTimeout\(idleTimerRef\.current\);\s*pulseAnim\.stopAnimation\(\);\s*pulseAnim\.setValue\(1\);\s*isPulsingRef\.current = false;\s*\};\s*\}, \[pulseAnim\]\);/,
  );
  assert.match(discover, /const isPulsingRef = useRef\(false\);/);
  assert.match(discover, /if \(isPulsingRef\.current\) return;/);
  assert.doesNotMatch(discover, /\[isPulsing, pulseAnim, startPulse\]/);
});
