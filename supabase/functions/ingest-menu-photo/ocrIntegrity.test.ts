import assert from "node:assert/strict";
import test from "node:test";
import { fallbackExtract, persistenceItems, toPriceCents, visionText } from "./ocrIntegrity.ts";

test("fallback selects actual price and preserves numbers in names", () => {
  const parsed = fallbackExtract(
    "1. Chicken Rice $5.50\n7 Up $2.00\nSet 2 ... 12.50\n2 pcs Wings\nTea SGD 3\nFish $5-$7\nCoffee $2 / $3",
  );
  assert.deepEqual(
    parsed.map(({ name, price }) => ({ name, price })),
    [
      { name: "Chicken Rice", price: 5.5 },
      { name: "7 Up", price: 2 },
      { name: "Set 2", price: 12.5 },
      { name: "2 pcs Wings", price: null },
      { name: "Tea", price: 3 },
      { name: "Fish $5-$7", price: null },
      { name: "Coffee $2 / $3", price: null },
    ],
  );
});
test("Vision image errors are failures unless usable annotations exist", () => {
  assert.throws(() => visionText({ responses: [{ error: { code: 13 } }] }), /vision_image_error/);
  assert.equal(visionText({ responses: [{}] }), "");
  assert.equal(
    visionText({ responses: [{ error: { code: 13 }, fullTextAnnotation: { text: " Tea $5 " } }] }),
    " Tea $5 ",
  );
  assert.equal(
    visionText({
      responses: [
        { fullTextAnnotation: { text: "  " }, textAnnotations: [{ description: "Pie" }] },
      ],
    }),
    "Pie",
  );
  assert.throws(() => visionText({}), /vision_invalid_response/);
});
test("persistence retains distinct same-price names, variants and exact evidence", () => {
  const items = persistenceItems([
    { name: "Tea", price: 5, modifiers: [], extraction_confidence: 0.95 },
    { name: "Pie", price: 5, modifiers: [], extraction_confidence: 0.7 },
    { name: "Tea", price: 6, modifiers: ["Large"], extraction_confidence: 1.5 },
    { name: "鱼汤", price: null, modifiers: [], extraction_confidence: NaN },
  ]);
  assert.deepEqual(
    items.map((x) => [x.name, x.price_cents, x.extraction_confidence]),
    [
      ["Tea", 500, 0.95],
      ["Pie", 500, 0.7],
      ["Tea", 600, 1],
      ["鱼汤", null, 0],
    ],
  );
  assert.equal(toPriceCents(Infinity), null);
  assert.equal(toPriceCents(2147483648), null);
});
