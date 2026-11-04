import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("Settings has a Language row that opens a sheet with every supported language", () => {
  const source = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.match(source, /label=\{t\("settings\.language\.label"\)\}/);
  assert.match(source, /setLanguageSheetVisible\(true\)/);
  assert.match(source, /SUPPORTED_LOCALES\.map/);
  assert.match(source, /LOCALE_NATIVE_NAMES\[code\]/);
  assert.match(source, /setLanguagePreference\(choice\)/);
  // The default entry follows the phone.
  assert.match(source, /value: "system"/);
});

test("the tab bars read their labels from the translation catalog", () => {
  const customer = read("src/app/navigation/SwipeableTabNavigator.tsx");
  for (const key of ["tab.home", "tab.feed", "tab.post", "tab.reviews", "tab.profile"]) {
    assert.ok(customer.includes(`t("${key}")`), key);
  }
  const merchant = read("src/app/navigation/MerchantTabs.tsx");
  for (const key of ["tab.home", "tab.menu", "tab.performance", "tab.profile"]) {
    assert.ok(merchant.includes(`t("${key}")`), key);
  }
});
