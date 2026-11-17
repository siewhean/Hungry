import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("both composer routes share the supported editor and protect real route removal", () => {
  const editor = readFileSync("src/app/screens/post/PostComposerScreen.tsx", "utf8");
  const variant = readFileSync("src/app/screens/post/PostComposerScreenV2.tsx", "utf8");
  assert.match(variant, /<PostComposerScreen \{\.\.\.props\} \/>/);
  const guard = readFileSync("src/features/post/useDraftExitGuard.ts", "utf8");
  const review = readFileSync("src/app/screens/review/ReviewScreen.tsx", "utf8");
  assert.match(editor, /useDraftExitGuard\(/);
  assert.match(review, /useDraftExitGuard\(/);
  assert.match(guard, /usePreventRemove\(input\.dirty && !allowed/);
  assert.match(guard, /text: "Save draft"/);
  assert.match(guard, /text: "Keep editing"/);
  assert.match(guard, /text: "Discard"/);
  assert.match(guard, /input\.dispatch\(pending\)/);
  assert.match(guard, /setAllowed\(false\)/);
  assert.doesNotMatch(
    variant,
    /MusicSearchModal|ComposerBottomBar|generateCaptions|suggestBestTime/,
  );
});

test("finishing a saved draft preserves its content", () => {
  const overlay = readFileSync("src/features/post/components/StatusOverlay.tsx", "utf8");
  const finish = overlay.slice(
    overlay.indexOf('label="Finish Later"'),
    overlay.indexOf('publishingState === "error"'),
  );
  assert.match(finish, /onFinish\?\.\(\)/);
  assert.doesNotMatch(finish, /reset\(\)/);
});
