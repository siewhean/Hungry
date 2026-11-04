import assert from "node:assert/strict";
import test from "node:test";

import { ALL_PASSPORT_CATEGORIES, PASSPORT_STAMP_DEFINITIONS } from "@/constants/passportConfig";
import { buildStampHistory, formatStampDate } from "@/features/passport/stampHistory";

const hawker = ALL_PASSPORT_CATEGORIES.find((item) => item.id === "cuisine-hawker")!;
const names: Record<string, string> = {
  a: "Ah Seng",
  b: "Bee Hoon King",
  c: "Char Kway Teow",
  d: "Not hawker",
};

test("each earned level names the visit that reached it and when", () => {
  assert.ok(hawker);
  const history = buildStampHistory({
    category: hawker,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [
      { stallId: "c", triedAt: "2026-11-03T10:00:00Z" },
      { stallId: "a", triedAt: "2026-11-01T10:00:00Z" },
      { stallId: "d", triedAt: "2026-11-02T10:00:00Z" },
      { stallId: "b", triedAt: "2026-11-02T12:00:00Z" },
    ],
    matches: (id) => id !== "d",
    nameOf: (id) => names[id],
  });
  const thresholds = hawker.stampThresholds;
  assert.equal(history.earned[0]?.unlockedBy?.name, "Ah Seng", "the first visit earns level one");
  assert.equal(history.earned[0]?.earnedAt, "2026-11-01T10:00:00Z");
  assert.equal(thresholds[1], 3);
  assert.equal(
    history.earned[1]?.unlockedBy?.name,
    "Char Kway Teow",
    "the third visit earns level two",
  );
  assert.deepEqual(
    history.stalls.map((stall) => stall.stallId),
    ["c", "b", "a"],
    "stalls that count, most recent first, without the one that does not",
  );
  assert.ok(history.next);
  assert.equal(history.next.remaining, history.next.stamp.threshold - 3);
});

test("no visits yet means nothing earned and the first stamp is next", () => {
  const history = buildStampHistory({
    category: hawker,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [],
    matches: () => true,
    nameOf: () => undefined,
  });
  assert.equal(history.earned.length, 0);
  assert.equal(history.next?.stamp.index, 0);
  assert.equal(history.next?.remaining, hawker.stampThresholds[0]);
});

test("visits without a date still count, after the dated ones", () => {
  const history = buildStampHistory({
    category: hawker,
    stamps: PASSPORT_STAMP_DEFINITIONS,
    triedStalls: [{ stallId: "b" }, { stallId: "a", triedAt: "2026-11-01T10:00:00Z" }],
    matches: () => true,
    nameOf: (id) => names[id],
  });
  assert.equal(history.earned[0]?.unlockedBy?.stallId, "a");
  assert.equal(history.stalls.length, 2);
});

test("dates read as day, month and year, and bad dates read as nothing", () => {
  assert.match(formatStampDate("2026-11-03T10:00:00Z") ?? "", /3 Nov 2026/);
  assert.equal(formatStampDate(undefined), null);
  assert.equal(formatStampDate("not a date"), null);
});
