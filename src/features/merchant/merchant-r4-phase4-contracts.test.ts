// Merchant round-four phase 4 source contracts: what a render test cannot see (silent catches,
// generic alert titles, locale-dependent dates) across every merchant screen.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DIR = "src/app/screens/merchant";
const screens = readdirSync(resolve(process.cwd(), DIR))
  .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
  .map((name) => ({ name, source: readFileSync(resolve(process.cwd(), DIR, name), "utf8") }));

test("R4-30: no merchant screen swallows a failure with `.catch(() =>`", () => {
  const offenders = screens
    .filter(({ source }) => /\.catch\(\s*\(\s*\)\s*=>/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], "use reportError (or reportAndUse) so Sentry sees the failure");
});

test("R4-29: no merchant screen titles a screen or an alert just 'Error'", () => {
  const offenders = screens
    .filter(({ source }) => /<Screen title="Error"|showAlert\("Error"/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], 'name what failed, e.g. "Couldn\'t send your reply"');
});

test("R4-32: no merchant screen prints a date with the device's locale", () => {
  const offenders = screens
    .filter(({ source }) => /toLocaleDateString\(\s*\)/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], "use formatRelativeDate or formatPromotionRange");
});

test("R4-19: the profile editor pins Save in the Screen footer and scrolls to sections", () => {
  const editor = screens.find(({ name }) => name === "BusinessProfileEditorScreen.tsx")?.source;
  assert.ok(editor);
  assert.match(
    editor,
    /footer=\{[\s\S]*?label=\{isSubmitting \? "Saving\.\.\." : "Save profile"\}/,
  );
  assert.match(editor, /handleSubmit\(onSubmit, onInvalid\)/);
  assert.match(editor, /scrollToSection\(openSection\)/);
  assert.match(editor, /scrollToSection\("hours"\)/);
});

test("R4-34: the text-filter migration has its rollback and smoke", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
  const migration = read("supabase/migrations/20261029170000_merchant_text_filter.sql");
  assert.match(migration, /^-- smoke: supabase\/smoke\/merchant_text_filter\.sql/);
  assert.match(migration, /on public\.dishes/);
  assert.match(migration, /on public\.merchant_outlets/);
  assert.match(
    read("supabase/rollbacks/20261029170000_merchant_text_filter.down.sql"),
    /drop trigger/,
  );
  assert.match(read("supabase/smoke/merchant_text_filter.sql"), /merchant_text_filter_passed/);
});
