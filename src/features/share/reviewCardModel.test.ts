import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_CARD_QUOTE_MAX,
  availableReviewCardTemplates,
  buildReviewCardModel,
  cardDateLabel,
  reviewCardHeight,
  reviewCardImageFormat,
  trimQuote,
  verdictFor,
} from "./reviewCardModel";

const base = {
  reviewId: "rev-1",
  dishName: "Chicken rice",
  venueName: "Ah Kow Chicken Rice",
  rating: 4,
  authorName: "Sam",
  createdAt: "2026-11-04T05:00:00.000Z",
};

test("trimQuote keeps short text, collapses spaces and cuts long text at a word", () => {
  assert.equal(trimQuote("  Rice is   the star.  "), "Rice is the star.");
  const long = "The broth is deep and peppery ".repeat(10);
  const cut = trimQuote(long);
  assert.ok(cut.length <= REVIEW_CARD_QUOTE_MAX);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("  "));
  assert.match(cut, /[a-z]…$/);
});

test("verdictFor turns a rating into a short line", () => {
  assert.equal(verdictFor(5), "Must try");
  assert.equal(verdictFor(4), "Go again");
  assert.equal(verdictFor(3), "Not bad");
  assert.equal(verdictFor(1), "Once is enough");
});

test("buildReviewCardModel cleans the review for a card", () => {
  const model = buildReviewCardModel({
    ...base,
    rating: 7.4,
    text: " Shiok ",
    tags: ["Spicy", "Spicy", " ", "Rich", "Crispy", "QQ"],
    photoUrl: "  ",
    authorName: " ",
  });
  assert.equal(model.rating, 5);
  assert.equal(model.quote, "Shiok");
  assert.deepEqual(model.tags, ["Spicy", "Rich", "Crispy"]);
  assert.equal(model.photoUrl, undefined);
  assert.equal(model.authorName, "A Hungry diner");
  assert.equal(model.verdict, "Must try");
  assert.equal(model.dateLabel, "4 Nov 2026");
});

test("buildReviewCardModel never shows a broken rating or empty dish", () => {
  const model = buildReviewCardModel({ ...base, dishName: " ", rating: Number.NaN });
  assert.equal(model.rating, 0);
  assert.equal(model.dishName, "A dish");
});

test("cardDateLabel falls back to today for a missing or bad date", () => {
  const now = new Date("2026-11-04T03:00:00.000Z");
  assert.equal(cardDateLabel(undefined, now), "4 Nov 2026");
  assert.equal(cardDateLabel("not a date", now), "4 Nov 2026");
});

test("photo templates lead when the review has a photo", () => {
  const model = buildReviewCardModel({ ...base, text: "Great", photoUrl: "file:///photo.jpg" });
  assert.deepEqual(availableReviewCardTemplates(model), [
    "photo",
    "snapshot",
    "quote",
    "chit",
    "sticker",
  ]);
});

test("a review without a photo or words still gets the chit and the sticker", () => {
  assert.deepEqual(availableReviewCardTemplates(buildReviewCardModel(base)), ["chit", "sticker"]);
  assert.deepEqual(availableReviewCardTemplates(buildReviewCardModel({ ...base, text: "Good" })), [
    "quote",
    "chit",
    "sticker",
  ]);
});

test("card heights follow Story 9:16 and Post 4:5", () => {
  assert.equal(reviewCardHeight("story", 360), 640);
  assert.equal(reviewCardHeight("post", 360), 450);
});

test("only the see-through sticker is saved as a PNG", () => {
  assert.equal(reviewCardImageFormat("sticker"), "png");
  assert.equal(reviewCardImageFormat("photo"), "jpg");
  assert.equal(reviewCardImageFormat("chit"), "jpg");
});
