import test from "node:test";
import assert from "node:assert/strict";

import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { REVIEW_MAX_PHOTOS, useReviewDraftStore } from "@/store/useReviewDraftStore";
import {
  createClientReviewId,
  createInitialReviewDraft,
  reviewDraftHasContent,
} from "./reviewDraft";

test("initial review draft leaves recommend unanswered", () => {
  const draft = createInitialReviewDraft();

  // null, not false: an untouched review must not be saved as "not recommended".
  assert.equal(draft.recommend, null);
  assert.equal(draft.rating, 0);
  assert.equal(draft.text, "");
  assert.deepEqual(draft.selectedTags, []);
});

test("initial review draft factory returns a fresh object", () => {
  const first = createInitialReviewDraft();
  const second = createInitialReviewDraft();

  first.selectedTags.push("Spicy");
  assert.deepEqual(second.selectedTags, []);
});

test("client review ids are RFC 4122 v4 uuids and unique", () => {
  const first = createClientReviewId();
  const second = createClientReviewId();
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, second);
});

test("selecting the same dish keeps the draft; a different dish resets it", () => {
  const store = useReviewDraftStore;
  store.getState().resetDraft();
  store.getState().selectDish("venue-a", "dish-a");
  store.getState().setRating(4);
  store.getState().setText("Great broth");
  const pendingId = store.getState().ensurePendingReviewId();
  const draftBefore = store.getState().draft;

  store.getState().selectDish("venue-a", "dish-a");
  assert.equal(store.getState().draft, draftBefore);
  assert.equal(store.getState().draft.rating, 4);
  assert.equal(store.getState().ensurePendingReviewId(), pendingId);

  store.getState().selectDish("venue-a", "dish-b");
  assert.equal(store.getState().draft.selectedDishId, "dish-b");
  assert.equal(store.getState().draft.rating, 0);
  assert.equal(store.getState().pendingReviewId, undefined);

  store.getState().resetDraft();
});

test("picking the first dish keeps rating, text and photos already entered", () => {
  const store = useReviewDraftStore;
  store.getState().resetDraft();
  store.getState().setRating(5);
  store.getState().setText("Before picking a dish");
  store.getState().addPhoto("file:///photo.jpg");

  store.getState().selectDish("venue-a", "dish-a");
  const { draft } = store.getState();
  assert.equal(draft.selectedDishId, "dish-a");
  assert.equal(draft.rating, 5);
  assert.equal(draft.text, "Before picking a dish");
  assert.deepEqual(draft.photos, ["file:///photo.jpg"]);

  store.getState().resetDraft();
});

test("draft content counts without a dish", () => {
  const draft = createInitialReviewDraft();
  assert.equal(reviewDraftHasContent(draft), false);
  assert.equal(reviewDraftHasContent({ ...draft, text: "tasty" }), true);
  assert.equal(reviewDraftHasContent({ ...draft, photos: ["file:///a.jpg"] }), true);
  assert.equal(reviewDraftHasContent({ ...draft, rating: 3 }), true);
});

test("a v1 persisted draft's default recommend=false migrates to unanswered", async () => {
  const options = useReviewDraftStore.persist.getOptions();
  assert.equal(options.version, 2);
  const migrated = (await options.migrate?.(
    { draft: { ...createInitialReviewDraft(), recommend: false } },
    1,
  )) as { draft: { recommend: boolean | null } };
  assert.equal(migrated.draft.recommend, null);
});

test("setText keeps what the user types: trailing spaces, newlines and ordinary words", () => {
  const store = useReviewDraftStore;
  store.getState().resetDraft();

  store.getState().setText("a ");
  assert.equal(store.getState().draft.text, "a ");

  const typed = "Select the laksa; don't update your order --\nworth it";
  store.getState().setText(typed);
  assert.equal(store.getState().draft.text, typed);

  store.getState().setText("x".repeat(REVIEW_TEXT_MAX_LENGTH + 20));
  assert.equal(store.getState().draft.text.length, REVIEW_TEXT_MAX_LENGTH);

  store.getState().resetDraft();
});

test("sanitizeFreeText strips markup and trims at submit but keeps words and line breaks", () => {
  assert.equal(
    sanitizeFreeText(
      "  Great food <script>alert(1)</script><b>here</b>;\r\n\n\n\nSelect the delete-me noodles  ",
      500,
    ),
    "Great food alert(1)here;\n\nSelect the delete-me noodles",
  );
  assert.equal(sanitizeFreeText("one   two\t three", 500), "one two three");
  assert.equal(sanitizeFreeText("abc def", 4), "abc");
});

test("review photos are capped and a duplicate pick is ignored", () => {
  const store = useReviewDraftStore;
  store.getState().resetDraft();
  store.getState().addPhoto("file:///a.jpg");
  store.getState().addPhoto("file:///a.jpg");
  assert.deepEqual(store.getState().draft.photos, ["file:///a.jpg"]);

  for (let index = 0; index < 10; index += 1) {
    store.getState().addPhoto(`file:///photo-${index}.jpg`);
  }
  assert.equal(store.getState().draft.photos.length, REVIEW_MAX_PHOTOS);

  // One remove tap removes one photo.
  store.getState().removePhoto("file:///a.jpg");
  assert.equal(store.getState().draft.photos.length, REVIEW_MAX_PHOTOS - 1);
  store.getState().resetDraft();
});
