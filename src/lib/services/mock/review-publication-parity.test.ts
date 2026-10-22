import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "./data";
import { hungryService } from "./mockService";
import { createClientReviewId } from "@/features/review/reviewDraft";

test("mock review publication is visible, canonical, retry-stable and ownership protected", async () => {
  const dish = dishes[0];
  const session = await hungryService.auth.signUp(
    "review-parity@example.sg",
    "password123",
    "Review parity",
  );
  assert.ok(session);
  const clientReviewId = createClientReviewId();
  const draft = {
    dishId: dish.id,
    venueId: dish.venueId,
    clientReviewId,
    rating: 4,
    text: "Review parity receipt",
    tags: dish.tasteTags,
    photos: [],
  };
  try {
    const receipt = await hungryService.reviews.submitReview(draft);
    assert.deepEqual(await hungryService.reviews.submitReview(draft), receipt);
    const recent = await hungryService.reviews.listRecentReviews({ query: draft.text });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].review.authorId, session.userId);
    assert.equal(recent[0].review.id, clientReviewId);
    assert.ok(
      (await hungryService.reviews.getUserReviews(session.userId)).some(
        (review) => review.id === clientReviewId,
      ),
    );
    const updated = { ...draft, text: "Review parity revised", rating: 5 };
    await hungryService.reviews.submitReview(updated);
    assert.equal(
      (await hungryService.reviews.listRecentReviews({ query: updated.text }))[0].review.rating,
      5,
    );
    assert.equal((await hungryService.reviews.listRecentReviews({ query: draft.text })).length, 0);
    await hungryService.auth.signOut();
    await hungryService.auth.signUp("review-stranger@example.sg", "password123", "Review stranger");
    await assert.rejects(() => hungryService.reviews.submitReview(draft), /authorized/);
    await assert.rejects(
      () =>
        hungryService.reviews.submitReview({
          ...draft,
          clientReviewId: createClientReviewId(),
          venueId: dishes.find((item) => item.venueId !== dish.venueId)!.venueId,
        }),
      /mismatch/,
    );
  } finally {
    await hungryService.auth.signOut();
  }
});
