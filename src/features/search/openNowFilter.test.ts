import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogRawDishCard, CatalogRawVenueCard } from "@/lib/services/catalog";
import { venues } from "@/lib/services/mock/data";
import type { VenueSummary } from "@/types/domain";

import { filterOpenNow, venueIdOfResult, venueIdsToRead } from "./openNowFilter";

const base = venues[0]!;
const stall = (id: string, patch: Partial<VenueSummary>): VenueSummary => ({
  ...base,
  id,
  isOpen: true,
  operatingHours: "",
  openingSchedule: undefined,
  closedUntil: undefined,
  ...patch,
});
const dishCard = (id: string, venueId: string) => ({ id, venueId }) as CatalogRawDishCard;
const stallCard = (id: string) => ({ id }) as CatalogRawVenueCard;

// Tuesday 2026-10-20, 12:00 in Singapore.
const NOON = new Date("2026-10-20T04:00:00Z");

const known = new Map<string, VenueSummary>([
  ["lunch", stall("lunch", { operatingHours: "Daily 10am-9pm" })],
  ["closed", stall("closed", { operatingHours: "Daily 5pm-9pm" })],
  [
    "schedule",
    stall("schedule", {
      operatingHours: "Daily 5pm-9pm",
      openingSchedule: { weekly: { tue: [{ open: "11:00", close: "14:00" }] } },
    }),
  ],
  ["no-hours", stall("no-hours", {})],
]);

test("a dish card names its stall and a stall card is the stall", () => {
  assert.equal(venueIdOfResult("dishes", dishCard("d1", "lunch")), "lunch");
  assert.equal(venueIdOfResult("stalls", stallCard("lunch")), "lunch");
});

test("dishes keep only the stalls whose hours say open now", () => {
  const items = [dishCard("d1", "lunch"), dishCard("d2", "closed"), dishCard("d3", "no-hours")];
  assert.deepEqual(
    filterOpenNow("dishes", items, known, NOON).map((item) => item.id),
    ["d1"],
  );
});

test("the structured schedule wins over listed hours, as on the stall page", () => {
  const items = [stallCard("schedule"), stallCard("closed")];
  assert.deepEqual(
    filterOpenNow("stalls", items, known, NOON).map((item) => item.id),
    ["schedule"],
  );
});

test("a stall whose hours are not read yet stays until they are", () => {
  const items = [stallCard("unread"), stallCard("closed")];
  assert.deepEqual(
    filterOpenNow("stalls", items, known, NOON).map((item) => item.id),
    ["unread"],
  );
});

test("a closed-until pause beats the hours", () => {
  const paused = new Map(known).set(
    "lunch",
    stall("lunch", { operatingHours: "Daily 10am-9pm", closedUntil: "2026-10-21T00:00:00Z" }),
  );
  assert.deepEqual(filterOpenNow("stalls", [stallCard("lunch")], paused, NOON), []);
});

test("only stalls not read yet are asked for, each once, up to the limit", () => {
  const items = [
    dishCard("d1", "lunch"),
    dishCard("d2", "new-a"),
    dishCard("d3", "new-a"),
    dishCard("d4", "new-b"),
    dishCard("d5", "new-c"),
  ];
  assert.deepEqual(venueIdsToRead("dishes", items, known), ["new-a", "new-b", "new-c"]);
  assert.deepEqual(venueIdsToRead("dishes", items, known, 2), ["new-a", "new-b"]);
});
