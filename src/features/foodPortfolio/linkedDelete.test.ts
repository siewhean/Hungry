// Deleting one half of a review and its portfolio entry (linkedDelete, roadmap 1.4): the person is
// asked about the other half only when there is one, a dismissed question deletes nothing, and a
// failed second delete is reported in the toast rather than lost.

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  askLinkedDelete,
  deleteLinked,
  findLinked,
  linkedDeleteMessage,
} from "@/features/foodPortfolio/linkedDelete";
import { getHungryService } from "@/lib/services/serviceProvider";
import { notifyChoiceSheetClosed, useChoiceSheetStore } from "@/store/useChoiceSheetStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

const service = getHungryService();
const original = {
  getEntryForReview: service.foodPortfolio.getEntryForReview,
  getReviewForEntry: service.foodPortfolio.getReviewForEntry,
  deletePost: service.social.deletePost,
  deleteReview: service.reviews.deleteReview,
};

afterEach(() => {
  service.foodPortfolio.getEntryForReview = original.getEntryForReview;
  service.foodPortfolio.getReviewForEntry = original.getReviewForEntry;
  service.social.deletePost = original.deletePost;
  service.reviews.deleteReview = original.deleteReview;
  useChoiceSheetStore.getState().settle(null);
  notifyChoiceSheetClosed();
});

async function answer(choice: string | null) {
  for (let i = 0; i < 50 && !useChoiceSheetStore.getState().request; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const request = useChoiceSheetStore.getState().request;
  assert.ok(request, "expected the question about the other half");
  useChoiceSheetStore.getState().settle(choice);
  notifyChoiceSheetClosed();
  return request;
}

function track() {
  const calls = { plain: 0, confirmed: [] as (string | null)[] };
  return {
    calls,
    confirmPlain: () => {
      calls.plain += 1;
    },
    onConfirmed: (otherId: string | null) => {
      calls.confirmed.push(otherId);
    },
  };
}

test("a review with no entry gets the usual confirm and no question", async () => {
  service.foodPortfolio.getEntryForReview = async () => null;
  const t = track();
  await askLinkedDelete("review", "r1", t.confirmPlain, t.onConfirmed);
  assert.equal(t.calls.plain, 1);
  assert.deepEqual(t.calls.confirmed, []);
  assert.equal(useChoiceSheetStore.getState().request, null);
});

test("a review with an entry asks; Delete both passes the entry, Delete only the review passes null", async () => {
  service.foodPortfolio.getEntryForReview = async () => "p1";
  const both = track();
  const asking = askLinkedDelete("review", "r1", both.confirmPlain, both.onConfirmed);
  const request = await answer("both");
  await asking;
  assert.equal(request.title, "Delete the portfolio entry too?");
  assert.deepEqual(
    request.options.map((option) => option.label),
    ["Delete both", "Delete only the review"],
  );
  assert.deepEqual(both.calls, { plain: 0, confirmed: ["p1"] });

  const one = track();
  const askingOne = askLinkedDelete("review", "r1", one.confirmPlain, one.onConfirmed);
  await answer("one");
  await askingOne;
  assert.deepEqual(one.calls, { plain: 0, confirmed: [null] });
});

test("dismissing the question about an entry's review deletes nothing", async () => {
  service.foodPortfolio.getReviewForEntry = async () => "r1";
  const t = track();
  const asking = askLinkedDelete("entry", "p1", t.confirmPlain, t.onConfirmed);
  const request = await answer(null);
  await asking;
  assert.equal(request.title, "Delete the review too?");
  assert.deepEqual(t.calls, { plain: 0, confirmed: [] });
});

test("a failed lookup is treated as no link, so the person can still delete", async () => {
  service.foodPortfolio.getReviewForEntry = async () => {
    throw new Error("offline");
  };
  assert.equal(await findLinked("entry", "p1"), null);
  const t = track();
  await askLinkedDelete("entry", "p1", t.confirmPlain, t.onConfirmed);
  assert.equal(t.calls.plain, 1);
});

test("deleting the entry after its review drops it from the published posts; a failure says so", async () => {
  const deleted: string[] = [];
  service.social.deletePost = async (postId) => {
    deleted.push(postId);
  };
  const version = usePublishedPostStore.getState().version;
  assert.equal(await deleteLinked("review", "p1"), true);
  assert.deepEqual(deleted, ["p1"]);
  assert.equal(usePublishedPostStore.getState().version, version + 1);

  service.reviews.deleteReview = async () => {
    throw new Error("rate limited");
  };
  assert.equal(await deleteLinked("entry", "r1"), false);
  assert.deepEqual(linkedDeleteMessage("entry", "failed"), {
    message: "Post deleted, but we couldn't delete the review. Try again from the dish page.",
    tone: "warning",
  });
  assert.deepEqual(linkedDeleteMessage("review", "deleted"), {
    message: "Review and portfolio entry deleted.",
    tone: "success",
  });
  assert.deepEqual(linkedDeleteMessage("review", "kept"), {
    message: "Review deleted.",
    tone: "success",
  });
});
