import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/screens/profile/FavouritesScreen.tsx"),
  "utf8",
);

test("favourites disclose fallback media and suppress missing catalog values", () => {
  assert.match(source, /getDishFallbackImageSource\(dish\)/);
  assert.match(source, /REPRESENTATIVE/);
  assert.match(source, /formatDiscoverPrice\(dish\)/);
  assert.match(source, /dish\.reviewCount > 0 && dish\.rating > 0/);
  assert.doesNotMatch(source, /source=\{\{ uri: dish\.imageUrl \}\}/);
  assert.doesNotMatch(source, /S\$\{dish\.price\.toFixed\(2\)\}/);
});
