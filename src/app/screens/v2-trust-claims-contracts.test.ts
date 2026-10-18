import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("V2 detail screens do not ship fabricated trust claims", () => {
  const sources = [
    read("src/app/screens/detail/StallDetailScreen.tsx"),
    read("src/app/screens/detail/DishDetailScreenV2.tsx"),
  ].join("\n");

  for (const forbidden of [
    "80m",
    "Open until 2:00 pm",
    "312 reviews",
    "180 reviews",
    "Taste profile (from 312 reviews)",
    "sarah.eats",
    "NEA",
  ]) {
    assert.doesNotMatch(sources, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(sources, /index % 2/);
});

test("V2 screens bind trust surfaces to venue and dish data", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(dish, /if \(liveCrowd === "low"\) return "< 15 min";/);
  assert.match(dish, /return null;/);
});
