import test from "node:test";

import {
  assertRepoFileExists,
  assertSourceExcludes,
  assertSourceIncludes,
  readRepoFile,
} from "@/test/sourceContracts";

test("shared standardization primitives are exported from the UI barrel", () => {
  [
    "src/components/ui/FilterChipRail.tsx",
    "src/components/ui/ChipGroup.tsx",
    "src/components/ui/StatusChip.tsx",
    "src/components/ui/InlineSearchField.tsx",
    "src/components/ui/FormSwitchRow.tsx",
    "src/components/ui/AppBottomTabItem.tsx",
    "src/components/ui/SelectField.tsx",
  ].forEach(assertRepoFileExists);

  const uiExports = readRepoFile("src/components/ui/index.ts");
  assertSourceIncludes(
    uiExports,
    [
      /export \* from "\.\/FilterChipRail"/,
      /export \* from "\.\/ChipGroup"/,
      /export \* from "\.\/StatusChip"/,
      /export \* from "\.\/InlineSearchField"/,
      /export \* from "\.\/FormSwitchRow"/,
      /export \* from "\.\/AppBottomTabItem"/,
      /export \* from "\.\/SelectField"/,
    ],
    "shared UI exports",
  );
});

test("primary user filter surfaces use shared chip primitives", () => {
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const review = readRepoFile("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewComposer = readRepoFile("src/app/screens/review/ReviewScreen.tsx");
  const quickBites = readRepoFile("src/app/screens/discover/QuickBitesScreen.tsx");
  const dishSearch = readRepoFile("src/app/screens/search/DishSearchScreen.tsx");
  const searchResults = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");
  const homeMap = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");
  const floorSelector = readRepoFile("src/components/map/FloorSelector.tsx");

  assertSourceIncludes(discover, [/<FilterChipRail[\s\S]*options=\{sortedChips\}/], "Discover");
  assertSourceIncludes(review, [/<FilterChipRail[\s\S]*options=\{FILTER_OPTIONS\}/], "Review");
  assertSourceIncludes(
    reviewComposer,
    [/<ChipGroup[\s\S]*options=\{REVIEW_TAGS\.map/],
    "Review composer taste tags",
  );
  assertSourceIncludes(
    quickBites,
    [/<FilterChipRail[\s\S]*options=\{cuisineFilterOptions\}/],
    "Quick Bites",
  );
  assertSourceIncludes(
    dishSearch,
    [/<ChipGroup[\s\S]*options=\{CATEGORY_OPTIONS\}/],
    "Dish Search",
  );
  assertSourceIncludes(
    searchResults,
    [/<FilterChipRail[\s\S]*options=\{RAW_BROWSE_FILTER_OPTIONS\}/],
    "Search Results browse filters",
  );
  assertSourceIncludes(
    homeMap,
    [/<FilterChipRail[\s\S]*options=\{HOME_MAP_FILTER_OPTIONS\}/],
    "Home Map filters",
  );
  assertSourceIncludes(
    floorSelector,
    [/<FilterChipRail[\s\S]*options=\{options\}/],
    "Floor selector filters",
  );
});

test("merchant filter and status surfaces use shared primitives", () => {
  const merchantMenu = readRepoFile("src/app/screens/merchant/MerchantMenuScreen.tsx");
  const inbox = readRepoFile("src/app/screens/merchant/CustomerInboxScreen.tsx");
  const analytics = readRepoFile("src/app/screens/merchant/MerchantAnalyticsScreen.tsx");
  const promotions = readRepoFile("src/app/screens/merchant/PromotionListScreen.tsx");
  const ocrDrafts = readRepoFile("src/app/screens/merchant/OCRDraftScreen.tsx");

  assertSourceIncludes(
    merchantMenu,
    [/<InlineSearchField[\s\S]*placeholder="Search menu\.\.\."/],
    "Merchant Menu search",
  );
  assertSourceIncludes(
    merchantMenu,
    [/<FilterChipRail[\s\S]*options=\{MENU_FILTER_OPTIONS\}/],
    "Merchant Menu filters",
  );
  assertSourceIncludes(
    inbox,
    [/<FilterChipRail[\s\S]*options=\{INBOX_FILTER_OPTIONS\}/],
    "Customer Inbox filters",
  );
  assertSourceIncludes(
    analytics,
    [/<FilterChipRail[\s\S]*options=\{ANALYTICS_RANGE_OPTIONS\}/],
    "Merchant Performance filters",
  );
  assertSourceIncludes(
    promotions,
    [
      /<FilterChipRail[\s\S]*options=\{PROMOTION_FILTER_OPTIONS\}/,
      /<StatusChip[\s\S]*tone=\{getPromotionStatusTone\(promo\.status\)\}/,
    ],
    "Promotion list filters and status",
  );
  assertSourceIncludes(
    ocrDrafts,
    [/<StatusChip[\s\S]*label=\{`\$\{Math\.round\(draft\.confidence \* 100\)\}% Match`\}/],
    "OCR draft confidence status",
  );
  assertSourceIncludes(ocrDrafts, [/<ChipGroup[\s\S]*suggestedTasteTags/], "OCR draft tags");
});

test("merchant forms use shared user-mode input, select, chip, and toggle primitives", () => {
  const businessProfile = readRepoFile("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  const dishEditor = readRepoFile("src/app/screens/merchant/DishEditorScreen.tsx");
  const promotionBuilder = readRepoFile("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  const inbox = readRepoFile("src/app/screens/merchant/CustomerInboxScreen.tsx");

  assertSourceIncludes(
    businessProfile,
    [
      /<Input[\s\S]*label="Business Name \*"/,
      /<SelectField[\s\S]*label="Business Type"/,
      /<ChipGroup[\s\S]*options=\{HOME_BASED_PRIVACY_OPTIONS\}/,
      /<FormSwitchRow[\s\S]*label="Show on Hungry"/,
    ],
    "Business Profile form",
  );
  assertSourceExcludes(
    businessProfile,
    [/<TextInput|<Switch|styles\.input|styles\.textArea/],
    "Business Profile raw controls",
  );

  assertSourceIncludes(
    dishEditor,
    [
      /<Input[\s\S]*label="Dish Name \*"/,
      /<ChipGroup[\s\S]*options=\{DIETARY_OPTIONS\.map/,
      /<FormSwitchRow[\s\S]*label="Available for sale"/,
      /<FormSwitchRow[\s\S]*label="Featured Dish"/,
    ],
    "Dish Editor form",
  );
  assertSourceExcludes(dishEditor, [/<TextInput|<Switch|<Chip\b/], "Dish Editor raw controls");

  assertSourceIncludes(
    promotionBuilder,
    [
      /<Input[\s\S]*label="Promotion Title \*"/,
      /<ChipGroup[\s\S]*options=\{PROMOTION_ITEM_TYPE_OPTIONS\}/,
      /<FormSwitchRow[\s\S]*label="Available"/,
    ],
    "Promotion Builder form",
  );
  assertSourceExcludes(
    promotionBuilder,
    [/<TextInput|<Switch|styles\.input|styles\.dateInput|styles\.audienceCard/],
    "Promotion Builder raw controls",
  );

  assertSourceIncludes(
    inbox,
    [/<Input[\s\S]*placeholder="Type your message\.\.\."/],
    "Customer Inbox reply input",
  );
  assertSourceExcludes(inbox, [/<TextInput|styles\.input/], "Customer Inbox raw reply input");
});

test("merchant settings and bottom tabs use shared user-mode primitives", () => {
  const merchantSettings = readRepoFile("src/app/screens/merchant/MerchantSettingsScreen.tsx");
  const merchantTabs = readRepoFile("src/app/navigation/MerchantTabs.tsx");
  const userTabs = readRepoFile("src/app/navigation/SwipeableTabNavigator.tsx");

  assertSourceIncludes(
    merchantSettings,
    [
      /<SettingsSection title="Business Account">/,
      /<SettingsSection title="Alerts">/,
      /<SettingsRow[\s\S]*label="Help & Support"/,
    ],
    "Merchant Settings",
  );
  assertSourceExcludes(
    merchantSettings,
    [/import \{ View, StyleSheet, Switch, Alert, Pressable \}/],
    "Merchant Settings raw controls",
  );
  assertSourceIncludes(merchantTabs, [/<AppBottomTabItem/], "Merchant Tabs");
  assertSourceIncludes(userTabs, [/<AppBottomTabItem/], "User Tabs");
});
