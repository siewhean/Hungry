import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("marketing hero keeps decorative atmosphere image hidden from assistive tech", () => {
  const hero = read("marketing/website/web-v2/src/components/sections/Hero.tsx");

  assert.match(hero, /className=\{styles\.atmosphere\} aria-hidden="true"/);
  assert.match(hero, /src=\{hero\.atmosphere\.src\}[\s\S]*alt=""[\s\S]*aria-hidden="true"/);
});

test("marketing hero food card images use descriptive content alt text", () => {
  const hero = read("marketing/website/web-v2/src/components/sections/Hero.tsx");
  const content = read("marketing/website/web-v2/src/content/site.ts");

  assert.match(hero, /hero\.foodCards\.map/);
  assert.match(hero, /alt=\{card\.alt\}/);

  const altValues = Array.from(content.matchAll(/alt: "([^"]+)"/g)).map((match) => match[1]);
  const foodAltValues = altValues.filter((alt) => /Top-down (bowl|plate) of /.test(alt));

  assert.ok(foodAltValues.length >= 12, "expected descriptive food alt text values");
  for (const alt of foodAltValues) {
    assert.doesNotMatch(alt, /\.(png|jpe?g|webp|avif)$/i);
    assert.doesNotMatch(alt, /^food\d*$/i);
    assert.match(alt, /\b(bowl|plate)\b/i);
  }
});
