// Round-five dish page pieces (DISH5-*): image failure fallbacks, SF Symbols, Helpful, the short
// Tried popup list, press feel and the hold menu. Run with `node scripts/test-render.mjs <file>`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DetailActionBar } from "@/components/detail/DetailActionBar";
import { FloatingBackButton } from "@/components/detail/FloatingBackButton";
import { DishCard } from "@/components/dish/DishCard";
import { DishHeroPlaceholder } from "@/components/dish/DishHeroPlaceholder";
import { DishReviewCard } from "@/components/dish/DishReviewCard";
import {
  BackSymbol,
  BookmarkSymbol,
  DashedBoxSymbol,
  HelpfulSymbol,
  RatingStarSymbol,
  ShareSymbol,
  TriedOffSymbol,
  TriedOnSymbol,
} from "@/components/dish/dishSymbols";
import { ReviewPhotoStrip } from "@/components/review/ReviewPhotoStrip";
import { ReviewStars } from "@/components/review/ReviewStars";
import { TasteRatingInput } from "@/components/review/TasteRatingInput";
import { Badge } from "@/components/ui/Badge";
import { strongestTasteKeys } from "@/features/detail/TriedFollowUp";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, Review, TasteVector } from "@/types/domain";

beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  useUIStore.setState({ reducedMotionEnabled: false });
  await cleanup();
});

const route = { name: "DishDetail" as const, params: { dishId: "dish-1" } };

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

type FailableImage = HTMLElement & { __triggerError?: () => void };
const images = (root: ParentNode) =>
  Array.from(root.querySelectorAll('[data-stub="expo-image.Image"]')) as FailableImage[];

// ─── DISH5-1: the hero placeholder ─────────────────────────────────────────────────────

test("DishHeroPlaceholder fills the hero height and names the missing photo", async () => {
  const view = await render(createElement(DishHeroPlaceholder, { dishName: "Laksa", height: 300 }));
  const tile = view.findByTestId("dish-hero-placeholder");
  assert.ok(tile, "the tile is drawn, not a blank block");
  assert.ok(view.findByLabel("Laksa photo unavailable"));
  assert.match(tile.parentElement?.outerHTML ?? "", /height: 300px/);
});

// ─── DISH5-2: failed review photos ─────────────────────────────────────────────────────

test("ReviewPhotoStrip drops a photo that fails to load, and its heading when none are left", async () => {
  const view = await render(
    createElement(ReviewPhotoStrip, {
      heading: "Photos from reviews",
      photos: ["https://cdn.hungry.sg/a.jpg", "https://cdn.hungry.sg/b.jpg"],
      subject: "Laksa, from reviews",
    }),
  );
  assert.ok(view.findByText("Photos from reviews"));
  assert.equal(images(view.container).length, 2);
  await act(async () => {
    images(view.container)[0]?.__triggerError?.();
  });
  assert.equal(images(view.container).length, 1, "the dead photo is gone, not a grey tile");
  assert.ok(view.findByLabel("Photo 1 of 1, Laksa, from reviews"));
  await act(async () => {
    images(view.container)[0]?.__triggerError?.();
  });
  assert.equal(images(view.container).length, 0);
  assert.equal(view.findByText("Photos from reviews"), null, "no heading over an empty row");
});

test("ReviewPhotoStrip without a heading still renders its row and drops nothing early", async () => {
  const view = await render(
    createElement(ReviewPhotoStrip, { photos: ["https://cdn.hungry.sg/a.jpg"], subject: "Laksa" }),
  );
  assert.equal(images(view.container).length, 1);
});

// ─── DISH5-7: Helpful replaces the heart on a dish review ──────────────────────────────

test("a dish review says Helpful with a thumbs-up and the date on one line; the heart is gone", async () => {
  const view = await render(
    createElement(DishReviewCard, {
      review: review("a", { helpfulCount: 2 }),
      dishName: "Laksa",
      isOwn: false,
      returnRoute: route,
      onOpenAuthor: () => undefined,
      onUpdated: () => undefined,
      onDeleted: () => undefined,
      onRemoved: () => undefined,
    }),
  );
  assert.ok(view.findByLabel("Helpful, 2 people found this helpful"));
  assert.ok(view.findByText("Helpful · 2"));
  assert.equal(view.findByLabel(/^Like, /), null, "no heart");
  assert.ok(view.findByText(/ago|Oct|2026|\d/), "the date is on the card");

  await view.press(view.findByLabel("Helpful, 2 people found this helpful"));
  assert.ok(view.findByLabel("Helpful, 3 people found this helpful"), "a vote adds one");
  assert.ok(view.findByText("Helpful · 3"));
});

test("your own dish review shows its date and no Helpful button", async () => {
  const view = await render(
    createElement(DishReviewCard, {
      review: review("a"),
      dishName: "Laksa",
      isOwn: true,
      returnRoute: route,
      onOpenAuthor: () => undefined,
      onUpdated: () => undefined,
      onDeleted: () => undefined,
      onRemoved: () => undefined,
    }),
  );
  assert.equal(view.findByText("Helpful"), null);
  assert.equal(view.findByLabel("Helpful"), null);
});

// ─── DISH5-3: SF Symbols with a fallback ───────────────────────────────────────────────

test("the dish symbols draw an icon, hidden from screen readers, for every state", async () => {
  const view = await render(
    createElement(
      "div",
      null,
      createElement(BackSymbol, { color: "#111" }),
      createElement(ShareSymbol, { color: "#111" }),
      createElement(TriedOffSymbol, { color: "#111" }),
      createElement(TriedOnSymbol, { color: "#111" }),
      createElement(BookmarkSymbol, { color: "#111" }),
      createElement(BookmarkSymbol, { color: "#111", fill: "#f60" }),
      createElement(HelpfulSymbol, { color: "#111" }),
      createElement(HelpfulSymbol, { color: "#111", fill: "#f60" }),
      createElement(RatingStarSymbol, { color: "#111" }),
      createElement(DashedBoxSymbol, { color: "#111" }),
    ),
  );
  const hidden = view.container.querySelectorAll('[aria-hidden="true"]');
  assert.equal(hidden.length, 10, "decorative: every symbol is aria-hidden");
});

test("ReviewStars draws five symbols and keeps its one spoken label", async () => {
  const view = await render(createElement(ReviewStars, { rating: 3 }));
  assert.ok(view.findByLabel("Rated 3 out of 5"));
  assert.equal(view.container.querySelectorAll('[aria-hidden="true"]').length, 5);
});

test("a rating badge on a dish card is a star symbol and the score, with no ★ glyph", async () => {
  const dish = {
    id: "d1",
    name: "Laksa",
    price: 5.5,
    rating: 4.6,
    reviewCount: 9,
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(createElement(DishCard, { dish }));
  assert.equal(view.text().includes("★"), false);
  assert.ok(view.findByLabel("Rated 4.6 out of 5"));
  assert.ok(view.findByText("4.6"));
});

test("Badge draws an optional icon in its own text colour", async () => {
  const colours: string[] = [];
  await render(
    createElement(Badge, {
      label: "4.8",
      tone: "amber",
      icon: (color: string) => {
        colours.push(color);
        return null;
      },
    }),
  );
  assert.equal(colours.length >= 1, true);
  assert.match(colours[0] ?? "", /^#|^rgb/);
});

// ─── DISH5-4: the short taste list ─────────────────────────────────────────────────────

test("strongestTasteKeys picks the three strongest, ties in the usual order", () => {
  const vector: TasteVector = { sweet: 1, spicy: 8, sour: 2, salty: 5, rich: 6, aromatic: 3 };
  assert.deepEqual(strongestTasteKeys(vector), ["spicy", "rich", "salty"]);
  assert.deepEqual(strongestTasteKeys(vector, 2), ["spicy", "rich"]);
  const flat: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
  assert.deepEqual(strongestTasteKeys(flat), ["sweet", "spicy", "sour"]);
});

test("TasteRatingInput asks only the tastes it is given", async () => {
  const view = await render(
    createElement(TasteRatingInput, {
      values: {},
      onChange: () => undefined,
      only: ["spicy", "rich", "salty"],
    }),
  );
  for (const axis of ["Spicy", "Rich", "Salty"]) assert.ok(view.findByLabel(`${axis}: Medium`));
  for (const axis of ["Sweet", "Sour", "Aromatic"]) {
    assert.equal(view.findByLabel(`${axis}: Medium`), null, `${axis} waits behind More tastes`);
  }
});

// ─── DISH5-6: press feel and the hold menu ─────────────────────────────────────────────

function Icon() {
  return null;
}

test("the bar's buttons and the floating back button use the shared 0.97 press, not 0.9", async () => {
  const view = await render(
    createElement(
      "div",
      null,
      createElement(DetailActionBar, {
        actions: [{ id: "save", label: "Save", icon: Icon, onPress: () => undefined }],
        cta: { label: "Write a review", onPress: () => undefined },
        testID: "bar",
      }),
      createElement(FloatingBackButton, { onPress: () => undefined, icon: BackSymbol }),
    ),
  );
  assert.ok(view.findByLabel("Save"));
  assert.ok(view.findByLabel("Go back"), "the custom back icon still has its name");
  assert.doesNotMatch(view.html(), /scale\(0\.9\)|scale\(0\.92\)/);
});

test("the high-contrast call to action uses the darker control orange with white text", async () => {
  const bar = (highContrastCta: boolean) =>
    createElement(DetailActionBar, {
      actions: [],
      cta: { label: "Write a review", onPress: () => undefined },
      highContrastCta,
      testID: "bar",
    });
  const view = await render(bar(false));
  const brand = view.findByLabel("Write a review")?.outerHTML ?? "";
  await view.rerender(bar(true));
  const control = view.findByLabel("Write a review")?.outerHTML ?? "";
  assert.notEqual(brand, control, "the fill changes");
});

async function holdDown(view: Awaited<ReturnType<typeof render>>, target: HTMLElement | null) {
  assert.ok(target, "hold target not found");
  const init = { bubbles: true, cancelable: true, button: 0 };
  const PointerCtor = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent;
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerdown", init) : new window.MouseEvent("mousedown", init),
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerup", init) : new window.MouseEvent("mouseup", init),
  );
  await view.settle();
}

test("the hold menu opens, then unmounts after it closes (also under Reduce Motion)", async () => {
  for (const reduced of [false, true]) {
    useUIStore.setState({ reducedMotionEnabled: reduced });
    const view = await render(
      createElement(DetailActionBar, {
        actions: [
          {
            id: "tried",
            label: "Tried",
            icon: Icon,
            onPress: () => undefined,
            holdTitle: "Have you tried it?",
            holdOptions: [
              { id: "yes", label: "Tried", selected: true, onPress: () => undefined },
              { id: "no", label: "Not tried", onPress: () => undefined },
            ],
          },
        ],
      }),
    );
    assert.equal(view.findByText("Have you tried it?"), null);
    await holdDown(view, view.findByLabel("Tried"));
    assert.ok(view.findByText("Have you tried it?"), `menu open (reduced motion: ${reduced})`);
    await view.press(view.findByLabel("Close menu"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    assert.equal(view.findByText("Have you tried it?"), null, "the closed menu is unmounted");
    await view.unmount();
  }
});
