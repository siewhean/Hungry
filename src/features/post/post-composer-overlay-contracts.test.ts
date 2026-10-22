import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("post composer controls the bottom-left food context overlay", () => {
  const domain = read("src/types/domain.ts");
  const serviceTypes = read("src/lib/services/types.ts");
  const store = read("src/features/post/useComposerStore.ts");
  const postTab = read("src/features/post/components/PostTab.tsx");
  const preview = read("src/features/post/components/LivePreviewSheet.tsx");
  const publishing = read("src/features/post/publishing.ts");
  const transforms = read("src/lib/services/postTransforms.ts");
  const homeFeed = read("src/components/social/FeedPostCard.tsx");

  assert.match(domain, /showFoodContextOverlay\?: boolean/);
  assert.match(serviceTypes, /showFoodContextOverlay\?: boolean/);
  assert.match(store, /showFoodContextOverlay: true/);
  assert.match(store, /setShowFoodContextOverlay: \(show: boolean\) => void/);
  assert.match(postTab, /Dish title on post/);
  assert.match(postTab, /value=\{showFoodContextOverlay\}/);
  assert.match(postTab, /onValueChange=\{setShowFoodContextOverlay\}/);
  assert.match(preview, /const showFoodContextOverlay = useComposerStore/);
  assert.match(preview, /foodContextOverlay/);
  assert.match(publishing, /showFoodContextOverlay: state\.showFoodContextOverlay/);
  assert.match(
    transforms,
    /showFoodContextOverlay: options\.showFoodContextOverlay \?\? bite\.showFoodContextOverlay/,
  );
  assert.match(
    homeFeed,
    /const shouldShowFoodContextOverlay = item\.showFoodContextOverlay !== false/,
  );
  assert.match(homeFeed, /\{shouldShowFoodContextOverlay \? \(/);
});
