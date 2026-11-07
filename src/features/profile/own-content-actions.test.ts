import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const TASTE = { sweet: 1, spicy: 1, sour: 1, salty: 1, rich: 1, aromatic: 1 };

test("H37: the author can edit and delete their own post (mock)", async () => {
  const bite = await hungryService.social.postBite({
    dishId: "dish-own-content-test",
    venueId: "venue-own-content-test",
    photoUrl: "https://example.com/own.jpg",
    caption: "First caption",
    tasteStamp: TASTE,
    rating: 4,
  });

  await hungryService.social.updatePost(bite.id, { caption: "  Edited <b>caption</b>  " });
  assert.equal((await hungryService.social.getPostById(bite.id))?.caption, "Edited caption");

  await hungryService.social.deletePost(bite.id);
  assert.equal(await hungryService.social.getPostById(bite.id), null);
  await assert.rejects(() => hungryService.social.deletePost(bite.id));
});

test("H37: nobody edits or deletes someone else's post (mock)", async () => {
  const feed = await hungryService.social.getBitesFeed();
  const profile = await hungryService.profile.getProfile();
  const foreign = feed.find((bite) => bite.authorId !== profile.id);
  assert.ok(foreign);
  await assert.rejects(() => hungryService.social.updatePost(foreign.id, { caption: "x" }));
  await assert.rejects(() => hungryService.social.deletePost(foreign.id));
  assert.ok(await hungryService.social.getPostById(foreign.id));
});

test("H37: Supabase post edit/delete is owner-scoped and a soft delete", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const update = /async updatePost\(postId, patch\) \{[\s\S]*?\n    \},/.exec(service)?.[0];
  const remove = /async deletePost\(postId\) \{[\s\S]*?\n    \},/.exec(service)?.[0];
  assert.ok(update && remove);
  for (const body of [update, remove]) {
    assert.match(body, /\.eq\("author_id", userId\)/);
    assert.match(body, /\.is\("deleted_at", null\)/);
    assert.match(body, /if \(count === 0\) throw/);
  }
  assert.match(update, /sanitizeFreeText\(patch\.caption, POST_CAPTION_MAX_LENGTH\)/);
  // Soft delete keeps reports and moderation history attached.
  assert.match(remove, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}/);
  assert.doesNotMatch(remove, /\.delete\(\)/);
});

test("H37: own posts and reviews get Edit/Delete entry points", () => {
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  assert.match(detail, /isOwnPost\s*\?\s*promptOwnContentActions\(\{\s*label: "post"/);
  assert.match(detail, /getHungryService\(\)\.social\.deletePost\(postId\)/);
  assert.match(detail, /getHungryService\(\)\.social\.updatePost\(postId, \{ caption: text \}\)/);
  assert.match(detail, /markPostRemovedForSession\(postId\)/);

  const actions = read("src/features/profile/ownContentActions.ts");
  // Built against the reviews data layer owned by H33 (group D).
  assert.match(actions, /updateReview\?: \(reviewId: string, patch: OwnReviewPatch\)/);
  assert.match(actions, /deleteReview\?: \(reviewId: string\)/);

  for (const path of [
    "src/app/screens/profile/ProfileHomeScreen.tsx",
    "src/app/screens/profile/ReviewHistoryScreen.tsx",
  ]) {
    const screen = read(path);
    assert.match(screen, /useOwnReviewEditor\(\{/, path);
    assert.match(screen, /ownReviewEditor\.enabled/, path);
    assert.match(screen, /ownReviewEditor\.openActions\(review\)/, path);
    assert.match(screen, /\{ownReviewEditor\.dialog\}/, path);
  }
});

test("The own post or review menu is an action sheet; only the delete confirmation is an alert", async () => {
  const { promptOwnContentActions } = await import("@/features/profile/ownContentActions");
  const { useChoiceSheetStore, notifyChoiceSheetClosed } =
    await import("@/store/useChoiceSheetStore");
  let edited = 0;
  promptOwnContentActions({ label: "review", onEdit: () => (edited += 1), onDelete: () => {} });
  const request = useChoiceSheetStore.getState().request;
  assert.equal(request?.title, "Your review");
  assert.deepEqual(
    request?.options.map((option) => [option.label, option.destructive === true]),
    [
      ["Edit review", false],
      ["Delete review", true],
    ],
  );
  useChoiceSheetStore.getState().settle("edit");
  notifyChoiceSheetClosed();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(edited, 1);
});

test("Delete in the own-content sheet asks to confirm, and only Delete in that alert removes it", async () => {
  const { Alert } = await import("react-native");
  const { promptOwnContentActions } = await import("@/features/profile/ownContentActions");
  const { useChoiceSheetStore, notifyChoiceSheetClosed } =
    await import("@/store/useChoiceSheetStore");
  const originalAlert = Alert.alert;
  const alerts: { title: string; buttons: { text?: string; onPress?: () => void }[] }[] = [];
  Alert.alert = ((title: string, _message?: string, buttons?: { text?: string }[]) => {
    alerts.push({ title, buttons: buttons ?? [] });
  }) as typeof Alert.alert;
  try {
    let deleted = 0;
    let edited = 0;
    const open = () =>
      promptOwnContentActions({
        label: "post",
        onEdit: () => (edited += 1),
        onDelete: () => (deleted += 1),
      });

    open();
    useChoiceSheetStore.getState().settle(null);
    notifyChoiceSheetClosed();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(alerts.length, 0, "dismissing the sheet does nothing");

    open();
    useChoiceSheetStore.getState().settle("delete");
    notifyChoiceSheetClosed();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(alerts.at(-1)?.title, "Delete this post?");
    assert.equal(deleted, 0, "not before the confirmation");
    alerts
      .at(-1)
      ?.buttons.find((button) => button.text === "Delete")
      ?.onPress?.();
    assert.equal(deleted, 1);
    assert.equal(edited, 0);
  } finally {
    Alert.alert = originalAlert;
  }
});

test("Own review edits and deletes go through the reviews service", async () => {
  const { canEditOwnReviews, deleteOwnReview, updateOwnReview } =
    await import("@/features/profile/ownContentActions");
  const reviews = hungryService.reviews as unknown as Record<string, unknown>;
  const originalUpdate = reviews.updateReview;
  const originalDelete = reviews.deleteReview;
  const calls: string[] = [];
  reviews.updateReview = async (id: string) => calls.push(`update:${id}`);
  reviews.deleteReview = async (id: string) => calls.push(`delete:${id}`);
  try {
    assert.equal(canEditOwnReviews(), true);
    await updateOwnReview("r1", { text: "Better" });
    await deleteOwnReview("r1");
    assert.deepEqual(calls, ["update:r1", "delete:r1"]);
    reviews.updateReview = undefined;
    reviews.deleteReview = undefined;
    assert.equal(canEditOwnReviews(), false);
    await assert.rejects(() => updateOwnReview("r1", {}), /not available/);
    await assert.rejects(() => deleteOwnReview("r1"), /not available/);
  } finally {
    reviews.updateReview = originalUpdate;
    reviews.deleteReview = originalDelete;
  }
});
