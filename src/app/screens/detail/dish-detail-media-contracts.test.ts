import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src/app/screens/detail/DishDetailScreenV2.tsx"),
  "utf8",
);

test("Dish detail applies the Discover media guard and discloses representative assets", () => {
  assert.match(source, /getDishHeroSelection\(dish\)/);
  assert.match(source, /getDishFallbackImageSource/);
  assert.match(source, /REPRESENTATIVE · NOT EXACT PHOTO/);
  assert.match(
    source,
    /Representative food image for \$\{dish\.name\}; not an exact photo of this dish/,
  );
  assert.match(
    source,
    /onError=\{showSourceImage \? \(\) => setSourceImageFailed\(true\) : undefined\}/,
  );
  assert.doesNotMatch(source, /accessibilityLabel=\{`\$\{dish\.name\} photo`\}/);
});

test("Dish detail shares only a source-backed remote image URL", () => {
  assert.match(
    source,
    /imageUrl: heroSelection\?\.kind === "dish" \? heroSelection\.imageUrl : ""/,
  );
});

test("Dish detail does not invent a description when the catalog has none", () => {
  assert.match(source, /No source-backed description is available for this dish yet\./);
  assert.doesNotMatch(source, /\$\{dish\.name\} is served by/);
});
