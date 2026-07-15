import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

for (const screen of ["DishDetailScreen.tsx", "StallDetailScreen.tsx"]) {
  test(`${screen} hides local-only review replies when comments are disabled`, () => {
    const source = read(`src/app/screens/detail/${screen}`);

    assert.match(
      source,
      /const submitReviewReply = \(reviewId: string\) => \{\s*if \(!FEATURE_FLAGS\.commentsEnabled\) \{\s*return;/,
    );
    assert.match(source, /FEATURE_FLAGS\.commentsEnabled \? \([\s\S]*Reply to review by/);
    assert.match(source, /FEATURE_FLAGS\.commentsEnabled && activeReplyReviewId === review\.id/);
  });
}
