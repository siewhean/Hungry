import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("DishCard joins only non-empty location parts and labels the save toggle Save/Saved", () => {
  const card = read("src/components/dish/DishCard.tsx");

  assert.doesNotMatch(card, /\{dish\.venueName\} · \{dish\.unitNumber\} · \{dish\.floor\}/);
  assert.match(
    card,
    /\[dish\.venueName, dish\.unitNumber, dish\.floor\][\s\S]*\.filter\(Boolean\)[\s\S]*\.join\(" · "\)/,
  );
  assert.match(card, /\{formatDishLocation\(dish\)\}/);
  assert.match(card, /accessibilityLabel=\{favourited \? "Saved" : "Save"\}/);
  assert.match(card, /accessibilityState=\{\{ selected: favourited \}\}/);
  assert.doesNotMatch(card, /favourites"/);
});

test("Weekly picks rail falls back to NoDishPhoto and drops the Sparkles icon", () => {
  const rail = read("src/components/dish/WeeklyPicksRail.tsx");

  assert.match(
    rail,
    /dish\.imageUrl \? \([\s\S]*<AccessibleImage[\s\S]*\) : \([\s\S]*<NoDishPhoto/,
  );
  assert.match(rail, /personalised \? "Picked for your taste\." : "Popular near you\."/);
  assert.doesNotMatch(rail, /Sparkles/);
});
