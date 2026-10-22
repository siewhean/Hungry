import assert from "node:assert/strict";
import test from "node:test";

import { buildDishPickerRows, formatPickerDistance } from "./dishPicker";

const venues = [
  { id: "v-far", name: "Far Noodles", unitNumber: "#01-01", buildingId: "b-far" },
  { id: "v-near", name: "Near Rice", unitNumber: "#02-02", buildingId: "b-near" },
];
const dishes = [
  { id: "d1", name: "Char Kway Teow", venueId: "v-far", venueName: "Far Noodles" },
  { id: "d2", name: "Char Siew Rice", venueId: "v-near", venueName: "Near Rice" },
];
const buildingCoordinates = new Map([
  ["b-far", { latitude: 1.3, longitude: 103.9 }],
  ["b-near", { latitude: 1.2801, longitude: 103.8451 }],
]);
const origin = { latitude: 1.28, longitude: 103.845 };

test("without a search the stall the viewer stands at comes first", () => {
  const rows = buildDishPickerRows({ venues, dishes, query: "", origin, buildingCoordinates });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["venue:v-near", "venue:v-far"],
  );
  assert.ok((rows[0]?.distanceMeters ?? Infinity) < 300);
});

test("without a known location stalls are listed by name", () => {
  const rows = buildDishPickerRows({ venues, dishes, query: "" });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["venue:v-far", "venue:v-near"],
  );
  assert.equal(rows[0]?.distanceMeters, undefined);
});

test("a dish can be found by name without knowing its stall", () => {
  const rows = buildDishPickerRows({
    venues,
    dishes,
    query: "kway teow",
    origin,
    buildingCoordinates,
  });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["dish:d1"],
  );
  const row = rows[0];
  assert.equal(row?.kind === "dish" ? row.venue?.id : undefined, "v-far");
});

test("stalls and dishes that match are listed together, nearest first", () => {
  const rows = buildDishPickerRows({ venues, dishes, query: "r", origin, buildingCoordinates });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["venue:v-near", "venue:v-far", "dish:d2", "dish:d1"],
  );
});

test("distances read as metres or kilometres", () => {
  assert.equal(formatPickerDistance(120), "120 m");
  assert.equal(formatPickerDistance(4), "10 m");
  assert.equal(formatPickerDistance(1460), "1.5 km");
});
