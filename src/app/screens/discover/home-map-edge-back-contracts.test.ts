import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Discover map has no swipe-back gesture, so panning the map never closes it", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const homeMap = read("src/app/screens/discover/HomeMapScreen.tsx");

  // The native swipe-back and the custom edge swipe both treated a rightward pan (to see the
  // left side of the map) as "go back". Pan wins; the back button and List toggle still leave.
  assert.match(
    rootNavigator,
    /getComponent=\{loadHomeMapScreen\}[\s\S]*name="DiscoverMap"[\s\S]*options=\{\{ gestureEnabled: false \}\}/,
  );
  assert.doesNotMatch(homeMap, /PanResponder|edgeBack|isMapEdgeBackSwipe/);
  assert.match(homeMap, /onPress=\{backToList\}/);
});
