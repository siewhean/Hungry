import assert from "node:assert/strict";
import test from "node:test";

import type { VenueSummary } from "@/types/domain";
import { dedupeNearestVenueCandidates, getVenueChainKey } from "./venueDedupe";

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
