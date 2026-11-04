import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createElement } from "react";

import { ReviewSuccessModal } from "@/app/screens/review/ReviewSuccessModal";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import { buildReviewCardModel } from "@/features/share/reviewCardModel";
import { setShareCardNativeForTests, type ShareCardNative } from "@/features/share/shareCardImage";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

import { ReviewShareCard } from "./ReviewShareCard";
import { ReviewShareStudio } from "./ReviewShareStudio";

const card = {
  reviewId: "rev-9",
  dishName: "Katong Laksa",
  venueName: "Laksa Stall",
  rating: 4,
  text: "Rich broth, proper cockles.",
  tags: ["Rich", "Spicy"],
  authorName: "Sam",
  createdAt: "2026-11-04T05:00:00.000Z",
};

function fakeNative() {
  const shared: { url: string; mimeType: string }[] = [];
  const captured: { width: number; height: number; format: string }[] = [];
  const native: ShareCardNative = {
    captureRef: async (_target, options) => {
      captured.push({ width: options.width, height: options.height, format: options.format });
      return `file:///tmp/card.${options.format}`;
    },
    isAvailableAsync: async () => true,
    shareAsync: async (url, options) => {
      shared.push({ url, mimeType: options.mimeType });
    },
  };
  return { native, shared, captured };
}

beforeEach(() => clearTrackedAnalyticsEvents());
afterEach(async () => {
  await cleanup();
  setShareCardNativeForTests(undefined);
  useUIStore.getState().hideReviewSuccess();
});

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((event) => event.event === name);

test("every card template prints the dish, the stall and the Hungry address", async () => {
  const model = buildReviewCardModel({ ...card, photoUrl: "https://example.com/laksa.jpg" });
  for (const template of ["photo", "snapshot", "mini", "quote", "chit", "sticker"] as const) {
    const view = await render(
      createElement(ReviewShareCard, {
        model,
        template,
        size: "story",
        testID: `card-${template}`,
      }),
    );
    const text = view.text();
    assert.match(text, /Katong Laksa/, `${template} shows the dish`);
    assert.match(text, /Laksa Stall/, `${template} shows the stall`);
    assert.ok(view.findByLabel(/rated 4 out of 5/), `${template} card has a spoken summary`);
    if (template !== "sticker" && template !== "mini")
      assert.match(text, /usehungry\.com/, `${template} names the site`);
    await view.unmount();
  }
});

test("the order chit lists the taste tags and a verdict, and words can be hidden", async () => {
  const model = buildReviewCardModel(card);
  const view = await render(
    createElement(ReviewShareCard, { model, template: "chit", size: "post" }),
  );
  assert.match(view.text(), /Rich/);
  assert.match(view.text(), /Spicy/);
  assert.match(view.text(), /Go again/);
  assert.match(view.text(), /Rich broth, proper cockles/);
  await view.rerender(
    createElement(ReviewShareCard, { model, template: "chit", size: "post", showQuote: false }),
  );
  assert.doesNotMatch(view.text(), /proper cockles/);
});

test("the share screen offers only the templates a review without a photo can fill", async () => {
  let closed = 0;
  const view = await render(
    createElement(ReviewShareStudio, {
      card,
      link: "https://usehungry.com/review/rev-9",
      source: "review_page",
      onClose: () => (closed += 1),
    }),
  );
  assert.ok(view.findByText("Big quote"));
  assert.ok(view.findByText("Order chit"));
  assert.ok(view.findByText("Sticker"));
  assert.equal(view.findByText("Photo"), null, "no photo, no photo template");
  assert.equal(view.findByText("Snapshot"), null);
  assert.equal(
    view.findByLabel("Show my words on the card"),
    null,
    "the small see-through tag comes first and never prints words",
  );
  const opened = events("review_card_opened");
  assert.equal(opened.length, 1);
  assert.equal(opened[0].properties.source, "review_page");
  assert.equal(opened[0].properties.template_count, 4);
  assert.ok(view.findByText("Mini"));
  await view.press(view.findByText("Big quote"));
  assert.ok(view.findByLabel("Show my words on the card"));

  await view.press(view.findByText("Sticker"));
  assert.equal(
    view.findByLabel("Show my words on the card"),
    null,
    "the sticker never prints words",
  );
  assert.match(view.text(), /place it over your own photo/);

  await view.press(view.findByText("Mini"));
  assert.equal(
    view.findByLabel("Show my words on the card"),
    null,
    "the mini tag never prints words",
  );
  assert.match(view.text(), /corner tag over your own photo/);

  await view.press(view.findByLabel("Close"));
  assert.equal(closed, 1);
});

test("Copy link copies the review link and says so", async () => {
  const view = await render(
    createElement(ReviewShareStudio, {
      card,
      link: "https://usehungry.com/review/rev-9",
      source: "review_page",
      onClose: () => undefined,
    }),
  );
  await view.press(view.findByText("Copy link"));
  await view.settle();
  assert.ok(view.findByText("Link copied"));
  const shared = events("review_shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].properties.channel, "copy_link");
});

test("Share picture captures the chosen card at Story size and opens the share sheet", async () => {
  const { native, shared, captured } = fakeNative();
  setShareCardNativeForTests(native);
  const view = await render(
    createElement(ReviewShareStudio, {
      card,
      link: "https://usehungry.com/review/rev-9",
      source: "review_posted",
      onClose: () => undefined,
    }),
  );
  await view.press(view.findByText("Order chit"));
  await view.press(view.findByText("Share picture"));
  await view.settle();
  // The render runtime is the web, which takes pixel sizes as they are.
  assert.deepEqual(captured, [{ width: 1080, height: 1920, format: "jpg" }]);
  assert.deepEqual(shared, [{ url: "file:///tmp/card.jpg", mimeType: "image/jpeg" }]);
  const sent = events("review_card_shared");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].properties.template, "chit");
  assert.equal(sent[0].properties.size, "story");
  assert.equal(sent[0].properties.source, "review_posted");
});

test("Share on Review posted opens the card screen when the build can make pictures", async () => {
  setShareCardNativeForTests(fakeNative().native);
  useUIStore.getState().showReviewSuccess({ ...card, xpEarned: 0 });
  const view = await render(createElement(ReviewSuccessModal, { onOpenHistory: () => undefined }));
  await view.press(view.findByText("Share"));
  assert.ok(view.findByTestId("review-share-studio"), "the card screen opens");
  assert.ok(view.findByText("Share your review"));
  await view.press(view.findByLabel("Close"));
  assert.equal(
    view.findByTestId("review-share-studio"),
    null,
    "closing returns to the confirmation",
  );
  assert.ok(view.findByText("Review posted"));
});
