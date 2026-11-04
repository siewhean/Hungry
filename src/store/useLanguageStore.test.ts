import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { SUPPORTED_LOCALES, setOfferedLocalesForTests } from "@/lib/i18n/locales";

import { getActiveLocale, resolveLocale, useLanguageStore } from "./useLanguageStore";

beforeEach(() => {
  setOfferedLocalesForTests(SUPPORTED_LOCALES);
  useLanguageStore.setState({ preference: "system" });
});
afterEach(() => setOfferedLocalesForTests(undefined));

test("languages not offered yet show as English, whatever was picked or the phone uses", () => {
  setOfferedLocalesForTests(undefined);
  assert.equal(resolveLocale("hi"), "en");
  assert.equal(resolveLocale("zh"), "en");
  assert.equal(resolveLocale("system"), "en");
});

test("defaults to following the phone", () => {
  assert.equal(useLanguageStore.getState().preference, "system");
});

test("the chosen language wins over the phone's", () => {
  useLanguageStore.getState().setPreference("hi");
  assert.equal(resolveLocale("hi"), "hi");
  assert.equal(getActiveLocale(), "hi");
});

test("'system' resolves to a supported language", () => {
  assert.ok(["en", "hi", "ms", "zh"].includes(resolveLocale("system")));
});

test("only the preference is persisted, and an unknown stored value falls back to the phone", () => {
  const { partialize, merge } = useLanguageStore.persist.getOptions();
  assert.deepEqual(partialize?.(useLanguageStore.getState()), { preference: "system" });
  const current = useLanguageStore.getState();
  assert.equal(merge?.({ preference: "ta" }, current).preference, "system");
  assert.equal(merge?.({ preference: "zh" }, current).preference, "zh");
  assert.equal(merge?.(undefined, current).preference, "system");
});
