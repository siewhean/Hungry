// The dish page's own pieces: loading preview, review summary and card, taste card, the
// report "..." and the review-list actions hook. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement, useState } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DishLoadingPreview } from "@/components/dish/DishLoadingPreview";
import { DishReviewCard } from "@/components/dish/DishReviewCard";
import { DishReviewSummary } from "@/components/dish/DishReviewSummary";
import { DishTasteCard } from "@/components/dish/DishTasteCard";
import { ReviewMoreButton } from "@/components/review/ReviewMoreButton";
import { buildReviewSummary } from "@/features/detail/dishReviewSummary";
import { useDishReviewActions } from "@/features/detail/useDishReviewActions";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Review, TasteVector } from "@/types/domain";

beforeEach(async () => {
  await enterScenario("user");
  useUIStore.setState({ safetyMenu: null });
});
afterEach(cleanup);

const route = { name: "DishDetail" as const, params: { dishId: "dish-1" } };
const vector: TasteVector = { sweet: 1, spicy: 8, sour: 2, salty: 5, rich: 6, aromatic: 3 };

function review(id: string, over: Partial<Review> = {}): Review {
  return {
    id,
    authorId: `user-${id}`,
    authorName: `Diner ${id}`,
    rating: 4,
    text: `Review ${id}`,
    createdAt: "2026-10-20T10:00:00.000Z",
    photos: [],
    tags: [],
    wouldRecommend: true,
    ...over,
  };
}

// ─── DishLoadingPreview ───────────────────────────────────────────────────────────────

test("DishLoadingPreview paints the name, price and stall a card already knew, and goes back", async () => {
  let backs = 0;
  const view = await render(
    createElement(DishLoadingPreview, {
      prefill: { name: "Laksa", price: 5.5, venueName: "Sungei Road Laksa", imageUrl: "" },
      onBack: () => {
        backs += 1;
      },
    }),
  );
  assert.match(view.text(), /Laksa/);
  assert.match(view.text(), /5\.50/);
  assert.match(view.text(), /Sungei Road Laksa/);
  await view.press(view.findByLabel(/back/i));
  assert.equal(backs, 1);
});

test("DishLoadingPreview shows a photo when the card had one", async () => {
  const view = await render(
    createElement(DishLoadingPreview, {
      prefill: { name: "Laksa", imageUrl: "https://example.test/laksa.jpg" },
      onBack: () => undefined,
    }),
  );
  assert.ok(view.container.querySelector('[data-stub="expo-image.Image"]'));
});

// ─── DishReviewSummary ────────────────────────────────────────────────────────────────

function summaryProps(reviews: Review[], over: Record<string, unknown> = {}) {
  return {
    rating: 4.2,
    ratingCount: 118,
    summary: buildReviewSummary(reviews),
    hasMore: false,
    sort: "newest" as const,
    onSort: () => undefined,
    withPhotos: false,
    onToggleWithPhotos: () => undefined,
    anyPhotos: true,
    showTools: true,
    ...over,
  };
}

test("DishReviewSummary shows the histogram and what diners mention from three reviews", async () => {
  const reviews = [
    review("a", { rating: 5, tags: ["Crispy"] }),
    review("b", { rating: 4, tags: ["Crispy"] }),
    review("c", { rating: 4 }),
  ];
  const view = await render(createElement(DishReviewSummary, summaryProps(reviews)));
  assert.match(view.text(), /118 ratings/);
  assert.ok(view.findByTestId("dish-review-histogram"));
  assert.match(view.text(), /Crispy · 2/);
});

test("DishReviewSummary shows no histogram for two reviews, or when the breakdown is off", async () => {
  const two = [review("a"), review("b")];
  const view = await render(createElement(DishReviewSummary, summaryProps(two)));
  assert.equal(view.findByTestId("dish-review-histogram"), null);
  const three = [review("a"), review("b"), review("c")];
  await view.rerender(
    createElement(DishReviewSummary, summaryProps(three, { showBreakdown: false })),
  );
  assert.equal(view.findByTestId("dish-review-histogram"), null);
  assert.match(view.text(), /118 ratings/);
});

test("DishReviewSummary sort and photo chips call back, and hide on the short preview", async () => {
  const sorts: string[] = [];
  let photoToggles = 0;
  const reviews = [review("a"), review("b"), review("c")];
  const view = await render(
    createElement(
      DishReviewSummary,
      summaryProps(reviews, {
        onSort: (sort: string) => sorts.push(sort),
        onToggleWithPhotos: () => {
          photoToggles += 1;
        },
      }),
    ),
  );
  await view.press(view.findByLabel("Only reviews with photos"));
  assert.equal(photoToggles, 1);
  await view.press(view.findByLabel("Sort by highest"));
  assert.equal(sorts.length, 1);
  await view.rerender(
    createElement(DishReviewSummary, summaryProps(reviews, { showTools: false })),
  );
  assert.equal(view.findByLabel("Only reviews with photos"), null);
});

// ─── DishTasteCard ────────────────────────────────────────────────────────────────────

test("DishTasteCard says 'to you' only with a palate, and offers the quiz without one", async () => {
  let quizzes = 0;
  const base = { dishVector: vector, hasEstimate: true, onTakeQuiz: () => (quizzes += 1) };
  const view = await render(createElement(DishTasteCard, base));
  assert.match(view.text(), /How it tastes/);
  assert.doesNotMatch(view.text(), /How it tastes to you/);
  await view.press(view.findByLabel("Take the taste quiz to see how it tastes to you"));
  assert.equal(quizzes, 1);

  await view.rerender(createElement(DishTasteCard, { ...base, palate: vector }));
  assert.match(view.text(), /How it tastes to you/);
  assert.equal(view.findByLabel("Take the taste quiz to see how it tastes to you"), null);
});

test("DishTasteCard names the diners behind an average", async () => {
  const view = await render(
    createElement(DishTasteCard, {
      dishVector: vector,
      hasEstimate: false,
      diners: { levels: { spicy: 4, sweet: 1, sour: 2 }, raters: 7 },
      onTakeQuiz: () => undefined,
    }),
  );
  assert.match(view.text(), /7 diners/);
});

// ─── DishReviewCard + ReviewMoreButton ────────────────────────────────────────────────

const cardProps = (over: Record<string, unknown> = {}) => ({
  review: review("a", { rating: 3 }),
  dishName: "Laksa",
  isOwn: false,
  returnRoute: route,
  onOpenAuthor: () => undefined,
  onUpdated: () => undefined,
  onDeleted: () => undefined,
  onRemoved: () => undefined,
  ...over,
});

test("DishReviewCard shows the author, stars and text, and opens the author", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(
      DishReviewCard,
      cardProps({ onOpenAuthor: (entry: Review) => opened.push(entry.id) }),
    ),
  );
  assert.match(view.text(), /Diner a/);
  assert.match(view.text(), /Review a/);
  assert.ok(view.findByLabel("Rated 3 out of 5"));
  await view.press(view.findByLabel("Open Diner a's profile"));
  assert.deepEqual(opened, ["a"]);
});

test("DishReviewCard gives someone else's review a visible '...' and your own edit actions", async () => {
  const view = await render(createElement(DishReviewCard, cardProps()));
  assert.ok(view.findByLabel("Report or block, review by Diner a"));
  await view.rerender(createElement(DishReviewCard, cardProps({ isOwn: true })));
  assert.equal(view.findByLabel("Report or block, review by Diner a"), null);
});

test("ReviewMoreButton opens the report and block sheet for a signed-in diner", async () => {
  const view = await render(
    createElement(ReviewMoreButton, {
      review: { id: "r1", authorId: "user-1", authorName: "Mei" },
      returnRoute: route,
      onRemoved: () => undefined,
    }),
  );
  await view.press(view.findByLabel("Report or block, review by Mei"));
  const menu = useUIStore.getState().safetyMenu;
  assert.equal(menu?.label, "review");
  assert.equal(menu?.authorName, "Mei");
  assert.equal(menu?.canBlock, true);
});

test("ReviewMoreButton asks a guest to sign in first and remembers the dish page", async () => {
  await enterScenario("guest");
  useUIStore.setState({ safetyMenu: null });
  const view = await render(
    createElement(ReviewMoreButton, {
      review: { id: "r1", authorId: "user-1", authorName: "Mei" },
      returnRoute: route,
      onRemoved: () => undefined,
    }),
  );
  await view.press(view.findByLabel("Report or block, review by Mei"));
  assert.equal(useUIStore.getState().safetyMenu, null);
  assert.ok(useUIStore.getState().signInPrompt);
  assert.deepEqual(useSessionStore.getState().returnRoute, route);
});

// ─── useDishReviewActions ─────────────────────────────────────────────────────────────

function ActionsHarness({ navigation }: { navigation: ReturnType<typeof createFakeNavigation> }) {
  const [reviews, setReviews] = useState<Review[]>([
    review("a", { text: "first" }),
    review("b", { text: "second" }),
  ]);
  const [changes, setChanges] = useState(0);
  const actions = useDishReviewActions({
    dishId: "dish-1",
    navigation: navigation as never,
    setReviews,
    onOwnReviewChanged: () => setChanges((count) => count + 1),
  });
  return createElement(
    "div",
    null,
    createElement(
      "p",
      { "data-testid": "state" },
      `${reviews.map((r) => r.text).join("|")} #${changes}`,
    ),
    createElement("button", {
      "aria-label": "edit",
      onClick: () => actions.updateReview("a", { text: "edited" }),
    }),
    createElement("button", { "aria-label": "delete", onClick: () => actions.deleteReview("b") }),
    createElement("button", { "aria-label": "remove", onClick: () => actions.removeReview("a") }),
    createElement("button", {
      "aria-label": "author",
      onClick: () => actions.openAuthor(reviews[0]),
    }),
    createElement("button", {
      "aria-label": "no-author",
      onClick: () => actions.openAuthor({ ...reviews[0], authorId: undefined }),
    }),
    createElement("p", { "data-testid": "route" }, JSON.stringify(actions.returnRoute)),
  );
}

test("useDishReviewActions edits, deletes, removes and opens the author", async () => {
  const navigation = createFakeNavigation();
  const view = await render(createElement(ActionsHarness, { navigation }));
  const state = () => view.findByTestId("state")?.textContent;
  assert.equal(state(), "first|second #0");
  assert.match(view.findByTestId("route")?.textContent ?? "", /"dishId":"dish-1"/);

  await view.press(view.findByLabel("edit"));
  assert.equal(state(), "edited|second #1");
  await view.press(view.findByLabel("delete"));
  assert.equal(state(), "edited #2");
  await view.press(view.findByLabel("no-author"));
  assert.equal(navigation.calls.length, 0);
  await view.press(view.findByLabel("author"));
  assert.equal(navigation.calls[0]?.method, "navigate");
  assert.equal(navigation.calls[0]?.args[0], "UserProfile");

  await view.press(view.findByLabel("remove"));
  assert.equal(state(), " #2");
});
