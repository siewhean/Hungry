import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { DISH_DETAIL_SOURCES, type DishDetailSource } from "./dishSources";

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(full);
  }
  return found;
}

/** The source text of every call that opens the dish page, up to its closing "});". */
function dishOpenCalls() {
  const calls: { file: string; text: string }[] = [];
  for (const file of walk(path.join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\.(navigate|push|replace)\("DishDetail",/g)) {
      const end = text.indexOf(");", match.index);
      calls.push({ file: path.relative(process.cwd(), file), text: text.slice(match.index, end) });
    }
  }
  return calls;
}

test("every call that opens a dish page says where it came from", () => {
  const calls = dishOpenCalls();
  assert.ok(calls.length >= 25, `expected the known entry points, found ${calls.length}`);
  const missing = calls.filter((call) => !/\bsource:/.test(call.text)).map((call) => call.file);
  assert.deepEqual(missing, [], "these dish page openings pass no `source` for dish_viewed");
});

test("every source a screen passes is a known DishDetailSource", () => {
  const known: readonly string[] = DISH_DETAIL_SOURCES;
  const used = dishOpenCalls().flatMap((call) =>
    [...call.text.matchAll(/\bsource: "([a-z_]+)"/g)].map((match) => match[1]),
  );
  assert.ok(used.length > 0);
  assert.deepEqual(
    used.filter((source) => !known.includes(source)),
    [],
  );
});

test("the source list has no duplicates and uses snake_case names", () => {
  assert.equal(new Set(DISH_DETAIL_SOURCES).size, DISH_DETAIL_SOURCES.length);
  const sample: DishDetailSource = "deep_link";
  assert.ok(DISH_DETAIL_SOURCES.includes(sample));
  for (const source of DISH_DETAIL_SOURCES) assert.match(source, /^[a-z]+(_[a-z]+)*$/);
});
