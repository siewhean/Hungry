import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Discover map keeps left-edge swipe back enabled", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const homeMap = read("src/app/screens/discover/HomeMapScreen.tsx");

  assert.match(
    rootNavigator,
    /<RootStack\.Screen[\s\S]*getComponent=\{loadHomeMapScreen\}[\s\S]*name="DiscoverMap"[\s\S]*options=\{\{ gestureEnabled: true \}\}/,
  );
  assert.match(homeMap, /const edgeBackPanResponder = useMemo/);
  assert.match(homeMap, /gestureState\.dx > 12/);
  assert.match(homeMap, /Math\.abs\(gestureState\.dx\) > Math\.abs\(gestureState\.dy\) \* 1\.5/);
  assert.match(homeMap, /gestureState\.dx > 64 \|\| gestureState\.vx > 0\.35/);
  assert.match(homeMap, /navigation\.canGoBack\(\)/);
  assert.match(homeMap, /navigation\.goBack\(\)/);
  assert.match(homeMap, /\{\.\.\.edgeBackPanResponder\.panHandlers\}/);
  assert.match(homeMap, /styles\.edgeBackGestureZone/);
  assert.match(homeMap, /width: Math\.max\(28, insets\.left \+ 24\)/);
});
