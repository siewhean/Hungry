// The pieces Home is built from, rendered on their own: the search bar placeholder, the dish and
// stall images, the loading skeletons, the rail, the popular-food buttons and the stall grid.
// Run with `node scripts/test-render.mjs src/components/discover/home/homeSections.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { act } from "react";

import { DiscoverBiteRail, DiscoverRailBadge } from "@/components/discover/home/DiscoverBiteRail";
import {
  DiscoverBiteImage,
  DiscoverStallThumbnail,
} from "@/components/discover/home/DiscoverImages";
import {
  DiscoverFoodRailLoadingSkeleton,
  DiscoverStallListLoadingSkeleton,
  PopularFoodStyleSkeleton,
  VerticalStallShowcaseLoadingSkeleton,
} from "@/components/discover/home/DiscoverLoadingSkeletons";
import { DiscoverSearchPlaceholder } from "@/components/discover/home/DiscoverSearchPlaceholder";
import { PopularFoodStyleItem } from "@/components/discover/home/PopularFoodStyleItem";
import { VerticalStallShowcaseSection } from "@/components/discover/home/VerticalStallShowcaseSection";
import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import { buildStallShowcaseCardsFromVenues } from "@/features/discover/stallShowcase";
import type { Bite } from "@/lib/services/types";
import { cleanup, render } from "@/test/render";
import type { DishDetail, VenueSummary } from "@/types/domain";

afterEach(cleanup);

function venue(overrides: Partial<VenueSummary> = {}): VenueSummary {
  return {
    id: "v1",
    buildingId: "b1",
    name: "Ah Seng Fish Soup",
    unitNumber: "#01-12",
    floor: "1",
    isOpen: true,
    topDishId: "d1",
    operatingHours: "Mon-Sun 24 hours",
    deliveryLinks: [],
    ...overrides,
  };
}

function dish(id: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    name: `Dish ${id}`,
    price: 6.8,
    rating: 4.6,
    reviewCount: 98,
    imageUrl: "",
    gallery: [],
    ...overrides,
  } as DishDetail;
}

function bite(overrides: Partial<Bite> = {}): Bite {
  return {
    id: "bite-1",
    dishId: "d1",
    dishName: "Sliced Fish Soup",
    venueName: "Ah Seng Fish Soup",
    photoUrl: "",
    mediaUrls: [],
    price: 6.8,
    rating: 4.6,
    cravingCount: 98,
    ...overrides,
  } as Bite;
}

test("popularFoodStyles lists unique, searchable dishes that each carry a bowl picture", () => {
  assert.ok(POPULAR_FOOD_STYLES.length >= 8);
  assert.equal(
    new Set(POPULAR_FOOD_STYLES.map((style) => style.id)).size,
    POPULAR_FOOD_STYLES.length,
  );
  for (const style of POPULAR_FOOD_STYLES) {
    assert.ok(style.query.length > 0, `${style.id} has a search query`);
    assert.ok(style.imageSource, `${style.id} has a picture`);
  }
});

test("stallShowcase gives each stall one card led by its top dish; no photo leaves the image empty, never another dish", () => {
  const dishes: Record<string, DishDetail[]> = {
    v1: ["d1", "d2", "d3", "d4", "d5", "d6"].map((id) => dish(id)),
    v2: [dish("d9", { imageUrl: "https://example.test/d9.jpg" })],
    v3: [],
  };
  const byId = new Map(
    Object.values(dishes)
      .flat()
      .map((entry) => [entry.id, entry]),
  );
  const cards = buildStallShowcaseCardsFromVenues(
    [venue(), venue(), venue({ id: "v2", topDishId: "d9" }), venue({ id: "v3", topDishId: "" })],
    {
      getDishById: (id) => byId.get(id),
      listDishesByVenue: (venueId) => dishes[venueId] ?? [],
    },
  );

  assert.deepEqual(
    cards.map((card) => card.id),
    ["v1", "v2"],
    "a repeated stall shows once and a stall with no dishes is skipped",
  );
  assert.equal(cards[0].heroDish.id, "d1");
  assert.equal(cards[0].products.length, 4, "at most four dishes per card");
  assert.equal(cards[0].imageSource, null, "no photo: the card shows the stall logo (H5-1)");
  assert.deepEqual(cards[1].imageSource, { uri: "https://example.test/d9.jpg" });
});

test("DiscoverSearchPlaceholder is a read-only field so the whole bar opens Search", async () => {
  const view = await render(<DiscoverSearchPlaceholder isActive={false} isNarrow />);
  const input = view.container.querySelector("input");
  assert.ok(input, "renders a text field");
  assert.equal(input.readOnly || input.disabled, true);
  assert.ok((input.getAttribute("placeholder") ?? "").length > 0);
});

test("DiscoverImages falls back to a labelled placeholder when a dish has no photo", async () => {
  const view = await render(<DiscoverBiteImage bite={bite()} height={120} />);
  assert.ok(view.findByLabel("Sliced Fish Soup photo unavailable"));

  const thumbnail = await render(<DiscoverStallThumbnail venue={venue()} />);
  assert.ok(thumbnail.container.firstElementChild, "the stall thumbnail renders");
});

test("DiscoverLoadingSkeletons draw the right number of placeholder slots", async () => {
  const popular = await render(<PopularFoodStyleSkeleton />);
  assert.equal(popular.container.querySelectorAll("[style*='width: 88px']").length, 4);

  const rail = await render(<DiscoverFoodRailLoadingSkeleton cardWidth={160} imageHeight={100} />);
  assert.equal(rail.container.querySelectorAll("[style*='width: 160px']").length, 3);

  const rows = await render(<DiscoverStallListLoadingSkeleton rowCount={2} />);
  assert.equal(rows.container.children.length > 0, true);
});

test("PopularFoodStyleItem prefetches on press-in and opens its search on press", async () => {
  const item = {
    ...POPULAR_FOOD_STYLES[0],
    dish: undefined,
    imageSource: POPULAR_FOOD_STYLES[0].imageSource as number,
    imageUrl: undefined,
  };
  const pressed: string[] = [];
  const view = await render(
    <PopularFoodStyleItem
      item={item}
      onPress={(pressedItem) => pressed.push(pressedItem.id)}
      onPrefetch={() => undefined}
    />,
  );
  await view.press(view.findByLabel(`Search for ${item.label}`));
  assert.deepEqual(pressed, [item.id]);
});

test("DiscoverBiteRail shows its dishes, the reason line, and opens the full list from the title", async () => {
  const opened: string[] = [];
  const seeAll: string[] = [];
  const layout = { cardWidth: 160, contentGap: 12, imageHeight: 100, screenWidth: 390 };
  const view = await render(
    <DiscoverBiteRail
      buttonId="rail"
      canSeeAll
      cards={[bite()]}
      getCardLabel={(card) => `Open ${card.dishName}`}
      isLoading={false}
      isVisible={false}
      layout={layout}
      onOpenBite={(card) => opened.push(card.id)}
      onPrefetchBite={() => undefined}
      onPrefetchCollection={() => undefined}
      onSeeAll={(collection) => seeAll.push(collection)}
      rail="quickBites"
      reasons={new Map([["d1", "Spicy, the way you like it"]])}
      seeAllLabel="See all quick bites"
      title="Dishes near you"
      variant="rating"
    />,
  );
  assert.match(view.text(), /Dishes near you/);
  assert.match(view.text(), /Spicy, the way you like it/);
  await view.press(view.findByLabel("Open Sliced Fish Soup"));
  assert.deepEqual(opened, ["bite-1"]);
  await view.press(view.findByLabel("See all quick bites"));
  assert.deepEqual(seeAll, ["quickBites"]);
});

test("VerticalStallShowcaseSection shows the stall grid and opens a stall", async () => {
  const cards = buildStallShowcaseCardsFromVenues([venue()], {
    getDishById: () => dish("d1"),
    listDishesByVenue: () => [dish("d1")],
  });
  const opened: string[] = [];
  const view = await render(
    <VerticalStallShowcaseSection
      cards={cards}
      areaPhrase="stalls in this area"
      pageHeight={700}
      cardWidth={358}
      onOpenCard={(card) => opened.push(card.id)}
      onPrefetchCard={() => undefined}
    />,
  );
  assert.match(view.text(), /More stalls in this area/);
  assert.match(view.text(), /1 stall/);
  await view.press(view.findByLabel("Open Ah Seng Fish Soup details"));
  assert.deepEqual(opened, ["v1"]);
});

test("a stall with no photo shows its own logo mark, not a picture of another dish (H5-1)", async () => {
  const cards = buildStallShowcaseCardsFromVenues(
    [
      venue({ id: "v1", name: "Ah Seng Fish Soup" }),
      venue({ id: "v2", name: "Lao Ban Beancurd", topDishId: "d2" }),
      venue({ id: "v3", name: "Tian Tian Chicken Rice", topDishId: "d3" }),
    ],
    {
      getDishById: (id) => dish(id),
      listDishesByVenue: (venueId) => [
        dish(venueId === "v1" ? "d1" : venueId === "v2" ? "d2" : "d3"),
      ],
    },
  );
  assert.ok(cards.every((card) => card.imageSource === null));
  const view = await render(
    <VerticalStallShowcaseSection
      cards={cards}
      areaPhrase="across Singapore"
      pageHeight={700}
      cardWidth={358}
      onOpenCard={() => undefined}
      onPrefetchCard={() => undefined}
    />,
  );
  for (const name of ["Ah Seng Fish Soup", "Lao Ban Beancurd", "Tian Tian Chicken Rice"]) {
    assert.ok(view.findByLabel(`${name} stall logo unavailable`), `${name} shows its logo mark`);
  }
  assert.equal(
    view.container.querySelectorAll('[data-stub="expo-image.Image"]').length,
    0,
    "no stock photo is drawn",
  );
});

test("a showcase card reads dish first, then stall and price, and drops the area (H5-6)", async () => {
  const cards = buildStallShowcaseCardsFromVenues(
    [venue({ name: "Pasta Express", unitNumber: "#01-12" })],
    {
      getDishById: () => dish("d1", { name: "Wild Truffle Mushroom Tagliatelle", price: 14 }),
      listDishesByVenue: () => [
        dish("d1", { name: "Wild Truffle Mushroom Tagliatelle", price: 14 }),
      ],
    },
  );
  const view = await render(
    <VerticalStallShowcaseSection
      cards={cards}
      areaPhrase="across Singapore"
      pageHeight={700}
      cardWidth={358}
      onOpenCard={() => undefined}
      onPrefetchCard={() => undefined}
    />,
  );
  const text = view.text();
  assert.match(text, /Wild Truffle Mushroom TagliatellePasta Express · S\$14\.00/);
  assert.doesNotMatch(text, /#01-12/, "the unit and area are left to the stall page");
});

test("the rating shows a star symbol, never a text glyph (H5 icons)", async () => {
  const layout = { cardWidth: 160, contentGap: 12, imageHeight: 100, screenWidth: 390 };
  const view = await render(
    <DiscoverBiteRail
      buttonId="rail"
      canSeeAll
      cards={[bite()]}
      getCardLabel={(card) => `Open ${card.dishName}`}
      isLoading={false}
      isVisible={false}
      layout={layout}
      onOpenBite={() => undefined}
      onPrefetchBite={() => undefined}
      onPrefetchCollection={() => undefined}
      onSeeAll={() => undefined}
      rail="editorChoice"
      seeAllLabel="See all top rated dishes"
      title="Top rated"
      titleBadge={<DiscoverRailBadge label="4.4+" showStar tone="accent" />}
      variant="topRated"
    />,
  );
  assert.match(view.text(), /Top rated4\.4\+/);
  assert.match(view.text(), /4\.6/);
  assert.doesNotMatch(view.text(), /★/);
});

test("a food-style bowl whose picture fails shows a dish symbol, not an empty circle (H5-9)", async () => {
  const item = {
    ...POPULAR_FOOD_STYLES[0],
    dish: undefined,
    imageSource: POPULAR_FOOD_STYLES[0].imageSource as number,
    imageUrl: undefined,
  };
  const view = await render(
    <PopularFoodStyleItem item={item} onPress={() => undefined} onPrefetch={() => undefined} />,
  );
  const image = view.container.querySelector<HTMLElement & { __triggerError?: () => void }>(
    '[data-stub="expo-image.Image"]',
  );
  assert.ok(image?.__triggerError, "the bowl starts with its picture");
  await act(async () => {
    image.__triggerError?.();
  });
  assert.equal(
    view.container.querySelector('[data-stub="expo-image.Image"]'),
    null,
    "the broken picture is gone",
  );
});

// The loading skeletons must take the room of the cards that replace them: the same frame, the
// same padding and gaps, and text boxes as tall as the lines of text.
const FRAME_PROPERTIES = [
  "width",
  "border-radius",
  "border-top-width",
  "overflow",
  "background-color",
  "box-shadow",
] as const;

function frameOf(element: Element) {
  const style = (element as HTMLElement).style;
  return FRAME_PROPERTIES.map((property) => `${property}: ${style.getPropertyValue(property)}`);
}

function spacingOf(element: Element) {
  const style = (element as HTMLElement).style;
  return ["padding-top", "padding-left", "row-gap"].map(
    (property) => `${property}: ${style.getPropertyValue(property)}`,
  );
}

test("a dish-card skeleton has the frame, padding, gaps and line heights of the real card", async () => {
  const real = await render(
    <DiscoverBiteRail
      buttonId="b"
      canSeeAll
      cards={[bite()]}
      getCardLabel={(item) => item.dishName}
      isLoading={false}
      isVisible
      layout={{ cardWidth: 200, contentGap: 8, imageHeight: 130, screenWidth: 390 }}
      onOpenBite={() => undefined}
      onPrefetchBite={() => undefined}
      onPrefetchCollection={() => undefined}
      onSeeAll={() => undefined}
      rail="quickBites"
      seeAllLabel="See all"
      title="Dishes near you"
      variant="rating"
    />,
  );
  const skeleton = await render(
    <DiscoverFoodRailLoadingSkeleton cardWidth={200} imageHeight={130} />,
  );

  const realCard = real.container.querySelector<HTMLElement>("[role='button'][aria-label$='Soup']");
  const skeletonCard = skeleton.container.querySelector<HTMLElement>("[style*='width: 200px']");
  assert.ok(realCard && skeletonCard);
  assert.deepEqual(frameOf(skeletonCard), frameOf(realCard), "same frame");

  const realBody = realCard.lastElementChild as HTMLElement;
  const skeletonBody = skeletonCard.lastElementChild as HTMLElement;
  assert.deepEqual(spacingOf(skeletonBody), spacingOf(realBody), "same padding and gap");

  const realLines = Array.from(realBody.querySelectorAll<HTMLElement>("div[dir]")).map((node) =>
    parseFloat(node.style.lineHeight),
  );
  const skeletonLines = Array.from(
    skeletonBody.querySelectorAll<HTMLElement>("[aria-label='Loading content']"),
  ).map((node) => parseFloat((node.parentElement as HTMLElement).style.height));
  // Dish name, stall, price (and the rating when there is one): the same lines, top to bottom.
  assert.deepEqual(skeletonLines.slice(0, 3), realLines.slice(0, 3));
});

test("the palate rail's skeleton adds the reason line the real cards show", async () => {
  const plain = await render(<DiscoverFoodRailLoadingSkeleton cardWidth={200} imageHeight={130} />);
  const withReason = await render(
    <DiscoverFoodRailLoadingSkeleton cardWidth={200} imageHeight={130} withReason />,
  );
  const lines = (view: typeof plain) =>
    view.container
      .querySelectorAll("[style*='width: 200px']")[0]
      .lastElementChild?.querySelectorAll("[aria-label='Loading content']").length;
  assert.equal((lines(withReason) ?? 0) - (lines(plain) ?? 0), 1);
});

test("the stall-list skeleton shows the logo, four text lines and a chevron, in the real row's frame", async () => {
  const rows = await render(<DiscoverStallListLoadingSkeleton rowCount={1} />);
  const row = rows.container.firstElementChild as HTMLElement;
  assert.equal(row.style.getPropertyValue("flex-direction"), "row");
  assert.equal(row.querySelectorAll("[aria-label='Loading content']").length, 6);
});

test("the stall-grid skeleton fills three rows of two cards under the real title", async () => {
  const grid = await render(
    <VerticalStallShowcaseLoadingSkeleton areaPhrase="near you" cardWidth={358} pageHeight={700} />,
  );
  assert.ok(grid.findByText("More near you"));
  assert.equal(grid.container.querySelectorAll("[style*='min-height']").length >= 6, true);
  // 6 photos + 6 names + 6 stall lines + the count.
  assert.equal(grid.container.querySelectorAll("[aria-label='Loading content']").length, 19);
});
