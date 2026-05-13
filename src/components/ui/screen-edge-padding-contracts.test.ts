import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Screen edge padding contract: app-level surfaces use the shared screenEdge token", () => {
  const tokens = read("src/theme/tokens.ts");
  const screen = read("src/components/ui/Screen.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const discoverV2 = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");

  assert.match(tokens, /screenEdge: 16/);
  assert.match(screen, /semanticSpacing\.screenEdge/);
  assert.doesNotMatch(screen, /paddingHorizontal: spacing\[3\]/);
  assert.match(home, /paddingHorizontal: semanticSpacing\.screenEdge/);
  assert.match(activity, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
  assert.match(activity, /paddingHorizontal: semanticSpacing\.screenEdge/);
  assert.match(discoverV2, /<Screen scroll=\{false\} fullWidth/);
  assert.match(discoverV2, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
});
