// Merchant round five: the phone format, tag helpers, and a contract that the Merchant Centre
// no longer draws icons with text characters.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatContactPhone } from "@/features/merchant/merchantReadiness";
import { addTags, mostUsedTags } from "@/features/merchant/tagSuggestions";

const read = (path: string) => readFileSync(path, "utf8");

test("R5-12: a Singapore number is shown as +65 9123 4567, anything else as typed", () => {
  for (const typed of ["+6591234567", "6591234567", "91234567", "9123 4567", "+65 9123-4567"]) {
    assert.equal(formatContactPhone(typed), "+65 9123 4567", typed);
  }
  assert.equal(formatContactPhone("  +65 6123 4567 "), "+65 6123 4567");
  assert.equal(formatContactPhone("+44 20 7946 0958"), "+44 20 7946 0958");
  assert.equal(formatContactPhone("12345"), "12345");
  assert.equal(formatContactPhone(""), "");
  assert.equal(formatContactPhone(undefined), "");
  assert.equal(formatContactPhone(null), "");
});

test("R5-10: tags are trimmed, de-duplicated by case and kept in order", () => {
  assert.deepEqual(addTags(["Spicy"], [" spicy ", "Creamy", "", "creamy"]), ["Spicy", "Creamy"]);
  assert.deepEqual(addTags([], ["a", "b"]), ["a", "b"]);
});

test("R5-10: the five most used tags come from the menu, once per dish, most used first", () => {
  const dishes = [
    { tasteTags: ["Spicy", "spicy", "Creamy"] },
    { tasteTags: ["spicy", "Sour"] },
    { tasteTags: ["Creamy", "Sweet", "Smoky", "Salty"] },
    { tasteTags: undefined },
  ];
  assert.deepEqual(mostUsedTags(dishes), ["Spicy", "Creamy", "Sour", "Sweet", "Smoky"]);
  assert.deepEqual(mostUsedTags(dishes, 2), ["Spicy", "Creamy"]);
  assert.deepEqual(mostUsedTags([]), []);
});

test("R5-2: Merchant Centre screens draw icons with symbols, not text characters", () => {
  const files = [
    "src/app/screens/merchant/CustomerInboxScreen.tsx",
    "src/app/screens/merchant/MerchantDashboardScreen.tsx",
    "src/app/screens/merchant/MerchantAnalyticsScreen.tsx",
    "src/app/screens/merchant/BusinessProfileEditorScreen.tsx",
    "src/app/screens/merchant/PromotionListScreen.tsx",
    "src/app/screens/merchant/MerchantMenuScreen.tsx",
    "src/app/screens/merchant/MerchantProfileScreen.tsx",
    "src/features/merchant/merchantReadiness.ts",
    "src/components/merchant/DailyBarChart.tsx",
    "src/components/merchant/PeakHoursChart.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    // The promotion price label still reads "S$5.50 → S$4.00" for the diner card.
    const code = source.replace(/S\$\$\{originalPrice\.toFixed\(2\)\} → /g, "");
    assert.doesNotMatch(code, /[★▲▼✓]/, `${file} has a text glyph`);
    assert.doesNotMatch(code, /→/, `${file} has a text arrow`);
  }
});

test("R5-8: merchant buttons are in sentence case", () => {
  for (const file of [
    "src/app/navigation/MerchantTabs.tsx",
    "src/app/screens/merchant/MerchantProfileScreen.tsx",
    "src/app/screens/merchant/MerchantSettingsScreen.tsx",
  ]) {
    assert.doesNotMatch(read(file), /Customer Mode|Mock Merchant/, file);
  }
});

test("R5-3: the toast sits above the tab bar and its safe-area inset", () => {
  const toast = read("src/components/ui/FloatingToast.tsx");
  assert.match(toast, /componentSizes\.bottomTabBar/);
  assert.match(toast, /insets\.bottom/);
  assert.doesNotMatch(toast, /bottom: 24/);
});
