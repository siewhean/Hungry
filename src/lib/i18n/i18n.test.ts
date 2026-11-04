import assert from "node:assert/strict";
import test from "node:test";

import { detectDeviceLocale } from "./detectDeviceLocale";
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, matchSupportedLocale } from "./locales";
import { en } from "./messages/en";
import { hi } from "./messages/hi";
import { ms } from "./messages/ms";
import { zh } from "./messages/zh";
import { translate } from "./translate";

const catalogs: Record<string, Record<string, string>> = { en, hi, ms, zh };
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

for (const code of SUPPORTED_LOCALES) {
  test(`${code} has exactly the English keys, no empty text and the same placeholders`, () => {
    const catalog = catalogs[code];
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(catalogs.en[key]), `${code}.${key}`);
    }
  });
}

test("every language is named in itself", () => {
  assert.deepEqual(Object.keys(LOCALE_NATIVE_NAMES).sort(), [...SUPPORTED_LOCALES].sort());
});

test("no language uses emoji", () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const [code, catalog] of Object.entries(catalogs)) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(emoji.test(value), false, `${code}.${key}`);
    }
  }
});

test("translate returns the text in the chosen language", () => {
  assert.equal(translate("zh", "tab.profile"), "我的");
  assert.equal(translate("ms", "settings.title"), "Tetapan");
  assert.equal(translate("hi", "settings.language.label"), "भाषा");
});

test("translate fills placeholders and leaves unknown ones visible", () => {
  const key = "tab.home";
  const original = catalogs.en[key];
  catalogs.en[key] = "Hi {name}, {missing}";
  try {
    assert.equal(translate("en", key, { name: "Mei" }), "Hi Mei, {missing}");
  } finally {
    catalogs.en[key] = original;
  }
});

test("translate falls back to English when a language lacks a key", () => {
  const original = catalogs.zh["tab.home"];
  delete catalogs.zh["tab.home"];
  try {
    assert.equal(translate("zh", "tab.home"), "Home");
  } finally {
    catalogs.zh["tab.home"] = original;
  }
});

test("matchSupportedLocale maps phone language tags", () => {
  assert.equal(matchSupportedLocale("zh-Hans-SG"), "zh");
  assert.equal(matchSupportedLocale("zh_CN"), "zh");
  assert.equal(matchSupportedLocale("ms-MY"), "ms");
  assert.equal(matchSupportedLocale("hi-IN"), "hi");
  assert.equal(matchSupportedLocale("en-SG"), "en");
  assert.equal(matchSupportedLocale("ta-SG"), null);
  assert.equal(matchSupportedLocale(""), null);
  assert.equal(matchSupportedLocale(undefined), null);
});

test("detectDeviceLocale follows a supported phone language and falls back to English", () => {
  const original = Intl.DateTimeFormat;
  const stub = (locale: string) =>
    (() => ({ resolvedOptions: () => ({ locale }) })) as unknown as typeof Intl.DateTimeFormat;
  try {
    Intl.DateTimeFormat = stub("ms-SG");
    assert.equal(detectDeviceLocale(), "ms");
    Intl.DateTimeFormat = stub("ta-SG");
    assert.equal(detectDeviceLocale(), "en");
    Intl.DateTimeFormat = (() => {
      throw new Error("no Intl");
    }) as unknown as typeof Intl.DateTimeFormat;
    assert.equal(detectDeviceLocale(), "en");
  } finally {
    Intl.DateTimeFormat = original;
  }
});
