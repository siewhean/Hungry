// StallHelpFillCard, StallHeroFallback, StallMenuDish and StallVisitedSheet: the stall page's
// own pieces. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import { StallHelpFillCard } from "@/components/stall/StallHelpFillCard";
import { StallHeroFallback } from "@/components/stall/StallHeroFallback";
import {
  menuDishAccessibilityLabel,
  shouldUseMenuList,
  StallMenuDishCard,
  StallMenuDishRow,
} from "@/components/stall/StallMenuDish";
import { StallReviewCard } from "@/components/stall/StallReviewCard";
import { StallVisitedSheet } from "@/components/stall/StallVisitedSheet";
import { cleanup, render } from "@/test/render";
import type { DishDetail } from "@/types/domain";

afterEach(cleanup);

const dishOf = (overrides: Partial<DishDetail>): DishDetail =>
  ({
    id: "dish-1",
    name: "Laksa",
    price: 5.5,
    priceRange: "",
    imageUrl: "",
    gallery: [],
    mustOrder: false,
    reviewCount: 0,
    rating: 0,
    availabilityFlags: [],
    ...overrides,
  }) as unknown as DishDetail;

test("StallHelpFillCard names only what is missing and offers one button per ask", async () => {
  const asked: string[] = [];
  const view = await render(
    createElement(StallHelpFillCard, {
      missing: ["menu", "reviews"],
      onAddMenuPhoto: () => asked.push("menu"),
      onWriteReview: () => asked.push("review"),
    }),
  );
  assert.match(view.container.textContent ?? "", /No menu and reviews yet\. Know this stall\?/);
  assert.ok(!view.container.textContent?.includes("Add opening hours"), "no hours ask when absent");
  await view.press(view.findByText("Add a menu photo"));
  await view.press(view.findByText("Write the first review"));
  assert.deepEqual(asked, ["menu", "review"]);
});

test("StallHeroFallback shows initials when the stall has no logo, and says the photo is unavailable", async () => {
  const view = await render(
    createElement(StallHeroFallback, { name: "Ah Seng Laksa", width: 320, height: 190 }),
  );
  assert.ok(view.findByLabel("Ah Seng Laksa photo unavailable"));
});

test("menuDishAccessibilityLabel reads the name, must order and the price or sold out", () => {
  assert.equal(menuDishAccessibilityLabel(dishOf({})), "Laksa, S$5.50");
  assert.equal(
    menuDishAccessibilityLabel(dishOf({ mustOrder: true })),
    "Laksa, must order, S$5.50",
  );
  assert.match(
    menuDishAccessibilityLabel(dishOf({ availabilityFlags: ["sold_out"] })),
    /sold out today/,
  );
});

test("shouldUseMenuList switches to rows when fewer than half the dishes have photos", () => {
  const photo =
    "https://frluxwpqqyomiqmjzavd.supabase.co/storage/v1/object/public/dish-photos/laksa.jpg";
  assert.equal(shouldUseMenuList([]), false);
  assert.equal(shouldUseMenuList([dishOf({ id: "a" }), dishOf({ id: "b" })]), true);
  assert.equal(
    shouldUseMenuList([dishOf({ id: "a", imageUrl: photo }), dishOf({ id: "b", imageUrl: photo })]),
    false,
  );
});

test("menu tiles and rows are buttons that open their own dish", async () => {
  const opened: string[] = [];
  const dish = dishOf({ id: "dish-9", name: "Chicken Rice" });
  const card = await render(
    createElement(StallMenuDishCard, {
      dish,
      width: 160,
      isLeftColumn: true,
      onPress: (picked: DishDetail) => opened.push(`card:${picked.id}`),
    }),
  );
  await card.press(card.findByLabel("Chicken Rice, S$5.50"));
  await cleanup();
  const row = await render(
    createElement(StallMenuDishRow, {
      dish,
      onPress: (picked: DishDetail) => opened.push(`row:${picked.id}`),
    }),
  );
  await row.press(row.findByLabel("Chicken Rice, S$5.50"));
  assert.deepEqual(opened, ["card:dish-9", "row:dish-9"]);
});

test("StallVisitedSheet offers dishes, writes a review without one, and skips", async () => {
  const events: string[] = [];
  const handlers = {
    stallName: "Ah Seng",
    onPickDish: (dish: DishDetail) => events.push(`pick:${dish.id}`),
    onWriteReview: () => events.push("write"),
    onSkip: () => events.push("skip"),
  };
  const closed = await render(
    createElement(StallVisitedSheet, { ...handlers, visible: false, dishes: [] }),
  );
  assert.ok(!closed.container.querySelector('[data-testid="stall-visited-sheet"]'));
  await cleanup();

  const withDishes = await render(
    createElement(StallVisitedSheet, {
      ...handlers,
      visible: true,
      dishes: [dishOf({ id: "d1", name: "Laksa" })],
    }),
  );
  await withDishes.press(withDishes.findByLabel("Review Laksa"));
  await withDishes.press(withDishes.findByText("Skip"));
  await cleanup();

  const empty = await render(
    createElement(StallVisitedSheet, { ...handlers, visible: true, dishes: [] }),
  );
  await empty.press(empty.findByText("Write a review"));
  assert.deepEqual(events, ["pick:d1", "skip", "write"]);
});

test("StallReviewCard names the author and dish, and opens each", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(StallReviewCard, {
      review: {
        id: "d1-r1",
        reviewId: "r1",
        dishId: "d1",
        dishName: "Laksa",
        authorId: "u1",
        authorName: "Mei",
        rating: 5,
        text: "Rich and spicy.",
        createdAt: new Date().toISOString(),
        photos: [],
        merchantReply: { text: "Thank you!", repliedAt: new Date().toISOString() },
      },
      venueId: "v1",
      isOwn: false,
      onOpenAuthor: () => opened.push("author"),
      onOpenDish: () => opened.push("dish"),
      onUpdated: () => undefined,
      onRemoved: () => undefined,
    }),
  );
  assert.match(view.container.textContent ?? "", /Rich and spicy\./);
  assert.match(view.container.textContent ?? "", /Reply from the owner/);
  await view.press(view.findByLabel("Open Laksa"));
  assert.deepEqual(opened, ["dish"]);
});
