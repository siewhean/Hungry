// A Home row keeps going with catalogue dishes once the feed's own run out.
// Run with `node scripts/test-render.mjs src/features/discover/useEndlessDishRail.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { catalogDishToBite } from "@/features/discover/catalogDishBite";
import { useEndlessDishRail } from "@/features/discover/useEndlessDishRail";
import type { CatalogPageRequest, CatalogRawDishCard } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { cleanup, render, settle } from "@/test/render";

afterEach(cleanup);

function card(id: string, extra: Partial<CatalogRawDishCard> = {}): CatalogRawDishCard {
  return {
    id,
    venueId: `venue-${id}`,
    buildingId: "bld-1",
    name: `Dish ${id}`,
    venueName: `Stall ${id}`,
    cuisineTags: [],
    dietaryFlags: [],
    sectionTags: [],
    verificationStatus: "unverified" as CatalogRawDishCard["verificationStatus"],
    menuRightsStatus: "",
    mediaRightsStatus: "",
    ...extra,
  };
}

async function mount(request: Omit<CatalogPageRequest, "cursor" | "limit"> | null) {
  let latest: ReturnType<typeof useEndlessDishRail> | undefined;
  function Probe() {
    latest = useEndlessDishRail(request);
    return null;
  }
  await render(<Probe />);
  return () => latest!;
}

function stubPages(pages: { items: CatalogRawDishCard[]; nextCursor?: string }[]) {
  const service = getCatalogRawService();
  const original = service.listDishes;
  const requests: CatalogPageRequest[] = [];
  service.listDishes = async (request) => {
    requests.push(request);
    const page = pages[requests.length - 1] ?? { items: [] };
    return { ...page, releaseId: "r1", totals: { venues: 0, dishes: 0 } };
  };
  return { requests, restore: () => (service.listDishes = original) };
}

test("nothing loads until the row reaches its end, then pages follow the cursor", async () => {
  const stub = stubPages([
    { items: [card("a"), card("b")], nextCursor: "c1" },
    { items: [card("b"), card("c")] },
  ]);
  try {
    const rail = await mount({ sort: "nearby", radiusMeters: 3000 });
    assert.equal(stub.requests.length, 0);
    rail().loadMore();
    await settle();
    assert.deepEqual(
      rail().bites.map((bite) => bite.dishId),
      ["a", "b"],
    );
    rail().loadMore();
    await settle();
    assert.equal(stub.requests[1].cursor, "c1");
    // A dish never repeats; the last page had no cursor, so the row stops asking.
    assert.deepEqual(
      rail().bites.map((bite) => bite.dishId),
      ["a", "b", "c"],
    );
    rail().loadMore();
    await settle();
    assert.equal(stub.requests.length, 2);
  } finally {
    stub.restore();
  }
});

test("a switched-off row never reads", async () => {
  const stub = stubPages([{ items: [card("a")] }]);
  try {
    const rail = await mount(null);
    rail().loadMore();
    await settle();
    assert.equal(stub.requests.length, 0);
    assert.equal(rail().bites.length, 0);
  } finally {
    stub.restore();
  }
});

test("a failed page stops the row instead of retrying in a loop", async () => {
  const service = getCatalogRawService();
  const original = service.listDishes;
  let calls = 0;
  service.listDishes = async () => {
    calls += 1;
    throw new Error("timeout");
  };
  try {
    const rail = await mount({ sort: "quality" });
    rail().loadMore();
    await settle();
    rail().loadMore();
    await settle();
    assert.equal(calls, 1);
  } finally {
    service.listDishes = original;
  }
});

test("a catalogue dish becomes a rail card with its price, rating and photo", () => {
  const bite = catalogDishToBite(
    card("x", { price: 5.5, rating: 4.6, reviewCount: 12, imageUrl: "https://example.com/x.jpg" }),
  );
  assert.equal(bite.dishId, "x");
  assert.equal(bite.price, 5.5);
  assert.equal(bite.rating, 4.6);
  assert.equal(bite.cravingCount, 12);
  assert.equal(bite.venueName, "Stall x");
  const bare = catalogDishToBite(card("y"));
  assert.equal(bare.photoUrl, "");
  assert.equal(bare.price, 0);
});
