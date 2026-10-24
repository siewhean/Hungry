import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Post composer exits return to the home feed instead of replaying stale back actions", () => {
  const composer = read("src/app/screens/post/PostComposerScreenV2.tsx");
  const overlay = read("src/features/post/components/StatusOverlay.tsx");

  assert.match(composer, /const allowExitRef = React\.useRef\(false\)/);
  assert.match(composer, /const returnToHomeFeed = React\.useCallback/);
  assert.match(composer, /type: "POP_TO"/);
  assert.match(composer, /payload: \{ name: "MainTabs", params: \{ screen: "Home" \} \}/);
  assert.match(composer, /const finishAndReturnToHomeFeed = React\.useCallback/);
  assert.match(composer, /allowExitRef\.current = true/);
  assert.match(composer, /if \(allowExitRef\.current\) \{\s*return;\s*\}/);
  assert.match(composer, /<ComposerHeader onClose=\{returnToHomeFeed\} \/>/);
  assert.match(composer, /<StatusOverlay onFinish=\{finishAndReturnToHomeFeed\} \/>/);
  assert.match(composer, /reset\(\);\s*finishAndReturnToHomeFeed\(\);/);
  assert.doesNotMatch(composer, /pendingAction/);
  assert.doesNotMatch(composer, /navigation\.reset/);
  assert.doesNotMatch(composer, /navigation\.goBack\(\)/);

  assert.match(overlay, /interface StatusOverlayProps/);
  assert.match(overlay, /onFinish\?: \(\) => void/);
  assert.match(overlay, /export function StatusOverlay\(\{ onFinish \}: StatusOverlayProps\)/);
  assert.match(
    overlay,
    /label=\{isReviewOnlySuccess \? "Done" : "View Post"\}[\s\S]*reset\(\);[\s\S]*onFinish\?\.\(\);/,
  );
  assert.match(overlay, /label="Finish later"[\s\S]*reset\(\);[\s\S]*onFinish\?\.\(\);/);
});
