import assert from "node:assert/strict";
import test from "node:test";

import type { VenueSummary } from "@/types/domain";
import { dedupeNearestVenueCandidates, getVenueBrandKey, getVenueChainKey } from "./venueDedupe";

test("the brand key never comes from the name alone (SEARCH-2)", () => {
  assert.equal(getVenueBrandKey({ id: "v1" }), "id:v1");
  assert.notEqual(getVenueBrandKey({ id: "v1" }), getVenueBrandKey({ id: "v2" }));
  assert.equal(
    getVenueBrandKey({ id: "v1", logoUrl: "https://logo.clearbit.com/yakun.com" }),
    getVenueBrandKey({ id: "v2", logoUrl: "https://logo.clearbit.com/yakun.com" }),
  );
});

function venue(overrides: Partial<VenueSummary> & Pick<VenueSummary, "id" | "name">): VenueSummary {
  return {
    buildingId: "building",
    deliveryLinks: [],
    floor: "01",
    isOpen: true,
    operatingHours: "09:00 - 21:00",
    topDishId: "dish",
    unitNumber: "#01-01",
    ...overrides,
  };
}

test("getVenueChainKey groups Clearbit logos by represented domain", () => {
  const liho = venue({
    id: "liho-1",
    name: "LIHO Chinatown",
    logoUrl: "https://logo.clearbit.com/lihotea.com",
  });

  assert.equal(getVenueChainKey(liho), "logo:lihotea.com");
});

test("dedupeNearestVenueCandidates keeps nearest branch for duplicate chain stalls", () => {
  const farLiho = venue({
    id: "liho-far",
    name: "LIHO",
    logoUrl: "https://logo.clearbit.com/lihotea.com",
  });
  const nearLiho = venue({
    id: "liho-near",
    name: "LIHO Tea",
    logoUrl: "https://logo.clearbit.com/lihotea.com",
  });
  const independent = venue({ id: "ah-kow", name: "Ah Kow Wanton Mee" });
  const items = [
    { distanceMeters: 900, venue: farLiho },
    { distanceMeters: 140, venue: independent },
    { distanceMeters: 120, venue: nearLiho },
  ];

  assert.deepEqual(
    dedupeNearestVenueCandidates(
      items,
      (item) => item.venue,
      (item) => item.distanceMeters,
    ).map((item) => item.venue.id),
    ["ah-kow", "liho-near"],
  );
});

test("dedupeNearestVenueCandidates groups exact normalized stall names without logos", () => {
  const far = venue({ id: "chain-far", name: "Toast Box - White Sands" });
  const near = venue({ id: "chain-near", name: "Toast Box - Chinatown" });

  assert.deepEqual(
    dedupeNearestVenueCandidates(
      [
        { distanceMeters: 450, venue: far },
        { distanceMeters: 80, venue: near },
      ],
      (item) => item.venue,
      (item) => item.distanceMeters,
    ).map((item) => item.venue.id),
    ["chain-near"],
  );
});

test("getVenueChainKey keeps stored brand logos from merging different chains", () => {
  const base = "https://yrlxjeovwslirseajomz.supabase.co/storage/v1/object/public/brand-logos";
  const subway = venue({ id: "subway-1", name: "Subway", logoUrl: `${base}/subway-1a2b3c4d.jpg` });
  const subwayToo = venue({
    id: "subway-2",
    name: "SUBWAY",
    logoUrl: `${base}/subway-1a2b3c4d.jpg`,
  });
  const kfc = venue({ id: "kfc-1", name: "KFC", logoUrl: `${base}/kfc-5e6f7a8b.png` });

  assert.equal(getVenueChainKey(subway), getVenueChainKey(subwayToo));
  assert.notEqual(getVenueChainKey(subway), getVenueChainKey(kfc));
});
