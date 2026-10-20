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
  // No overlay strip: the root captures only a horizontal move that starts at the edge,
  // so taps on the map, legend and cards are never swallowed.
  assert.doesNotMatch(homeMap, /edgeBackGestureZone|pointerEvents="box-only"/);
  assert.match(homeMap, /const edgeBackZoneWidth = Math\.max\(28, insets\.left \+ 24\)/);
  assert.match(
    homeMap,
    /onMoveShouldSetPanResponderCapture:[\s\S]*gestureState\.x0 <= edgeBackZoneWidth/,
  );
});
