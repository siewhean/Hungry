import assert from "node:assert/strict";
import test from "node:test";
import { blogPosts } from "@/lib/services/mock/data";
import { loadExactArticle } from "./articleInspector";

test("article inspector never substitutes a different cached article", async () => {
  const original = blogPosts[0];
  assert.ok(original);
  assert.equal(await loadExactArticle(undefined, async () => original), undefined);
  assert.equal(await loadExactArticle("missing-article", async () => original), undefined);
  assert.equal(await loadExactArticle(original.id, async () => original), original);
});

test("article lookup failures propagate for the retry state", async () => {
  const original = blogPosts[0];
  assert.ok(original);
  await assert.rejects(
    () =>
      loadExactArticle(original.id, async () => {
        throw new Error("offline");
      }),
    /offline/,
  );
});
