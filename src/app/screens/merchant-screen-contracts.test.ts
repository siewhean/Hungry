import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

type MerchantScreenContract = {
  route: string;
  component: string;
  file: string;
  hidden?: boolean;
};

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function segmentBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

const merchantScreens = [
  {
    route: "Dashboard",
    component: "MerchantDashboardScreen",
    file: "src/app/screens/merchant/MerchantDashboardScreen.tsx",
  },
  {
    route: "Menu",
    component: "MerchantMenuScreen",
    file: "src/app/screens/merchant/MerchantMenuScreen.tsx",
  },
  {
    route: "Analytics",
    component: "MerchantAnalyticsScreen",
    file: "src/app/screens/merchant/MerchantAnalyticsScreen.tsx",
  },
  {
    route: "Profile",
    component: "MerchantProfileScreen",
    file: "src/app/screens/merchant/MerchantProfileScreen.tsx",
  },
  {
    route: "VerificationCentre",
    component: "VerificationCentreScreen",
    file: "src/app/screens/merchant/VerificationCentreScreen.tsx",
    hidden: true,
  },
  {
    route: "HomeBasedVerification",
    component: "HomeBasedVerificationScreen",
    file: "src/app/screens/merchant/HomeBasedVerificationScreen.tsx",
    hidden: true,
  },
  {
    route: "CustomerInbox",
    component: "CustomerInboxScreen",
    file: "src/app/screens/merchant/CustomerInboxScreen.tsx",
    hidden: true,
  },
  {
    route: "FeaturedVisitors",
    component: "FeaturedVisitorsScreen",
    file: "src/app/screens/merchant/FeaturedVisitorsScreen.tsx",
    hidden: true,
  },
  {
    route: "BusinessProfileEditor",
    component: "BusinessProfileEditorScreen",
    file: "src/app/screens/merchant/BusinessProfileEditorScreen.tsx",
    hidden: true,
  },
  {
    route: "DishEditor",
    component: "DishEditorScreen",
    file: "src/app/screens/merchant/DishEditorScreen.tsx",
    hidden: true,
  },
  {
    route: "OCRDrafts",
    component: "OCRDraftScreen",
    file: "src/app/screens/merchant/OCRDraftScreen.tsx",
    hidden: true,
  },
  {
    route: "PromotionList",
    component: "PromotionListScreen",
    file: "src/app/screens/merchant/PromotionListScreen.tsx",
    hidden: true,
  },
  {
    route: "PromotionBuilder",
    component: "PromotionBuilderScreen",
    file: "src/app/screens/merchant/PromotionBuilderScreen.tsx",
    hidden: true,
  },
  {
    route: "AIAssistant",
    component: "AIAssistantScreen",
    file: "src/app/screens/merchant/AIAssistantScreen.tsx",
    hidden: true,
  },
  {
    route: "OrdersComingSoon",
    component: "OrdersComingSoonScreen",
    file: "src/app/screens/merchant/OrdersComingSoonScreen.tsx",
    hidden: true,
  },
  {
    route: "MerchantSettings",
    component: "MerchantSettingsScreen",
    file: "src/app/screens/merchant/MerchantSettingsScreen.tsx",
    hidden: true,
  },
] satisfies readonly MerchantScreenContract[];

function screenBlock(source: string, route: string): string {
  const start = source.indexOf(`name="${route}"`);
  assert.notEqual(start, -1, `${route} should be registered in MerchantTabs`);
  return source.slice(start, start + 220);
}

test("Merchant screen contract: every merchant route is typed, registered, and backed by a screen", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");

  for (const screen of merchantScreens) {
    assert.match(navigationTypes, new RegExp(`${screen.route}:`));
    assert.match(tabs, new RegExp(`name="${screen.route}"`));
    assert.match(tabs, new RegExp(screen.component));
    assert.equal(exists(screen.file), true, `${screen.file} should exist`);
  }
});

test("Merchant screen contract: verified-only routes are guarded by merchant access status", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  const guards = read("src/features/merchant/merchantGuards.ts");

  assert.match(tabs, /resolveMerchantAccess/);
  assert.match(tabs, /MerchantAccessGate/);
  assert.match(
    tabs,
    /initialRouteName=\{access === "verified" \? "Dashboard" : "VerificationCentre"\}/,
  );

  for (const route of [
    "Dashboard",
    "Menu",
    "Profile",
    "DishEditor",
    "OCRDrafts",
    "CustomerInbox",
    "FeaturedVisitors",
    "PromotionBuilder",
    "PromotionList",
    "AIAssistant",
    "BusinessProfileEditor",
    "OrdersComingSoon",
    "MerchantSettings",
    "Analytics",
  ]) {
    assert.match(guards, new RegExp(`"${route}"`));
    assert.match(tabs, new RegExp(`createGuardedScreen\\(\\s*"${route}"`));
  }
});

test("Merchant screen contract: extended merchant sections stay hidden from the tab bar", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");

  for (const screen of merchantScreens.filter((item) => item.hidden)) {
    assert.match(screenBlock(tabs, screen.route), /tabBarStyle: \{ display: "none" \}/);
  }
});

test("Merchant screen contract: merchant navigation buttons are accessible and hidden sections are reachable", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  const dashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");

  assert.match(tabs, /accessibilityLabel=\{`Merchant \$\{tabConfig\.label\}`\}/);
  assert.match(tabs, /tabConfig\.label/);

  assert.doesNotMatch(dashboard, /QR ordering setup|Preview Ordering|Review menu, photo, demand/);
  assert.match(dashboard, /Business summary/);
  for (const route of ["FeaturedVisitors", "PromotionList", "AIAssistant", "MerchantSettings"]) {
    assert.match(dashboard, new RegExp(`prefetchMerchantRoute\\("${route}"\\)`));
    assert.match(dashboard, new RegExp(`navigation\\.navigate\\("${route}"\\)`));
  }
});

test("Merchant screen contract: merchant route params match editable sub-screen needs", () => {
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");

  assert.match(navigationTypes, /DishEditor: \{ dishId\?: string \} \| undefined;/);
  assert.match(navigationTypes, /PromotionBuilder: \{ promotionId\?: string \} \| undefined;/);
  assert.match(navigationTypes, /OCRDrafts: undefined;/);
  assert.match(navigationTypes, /CustomerInbox: undefined;/);
  assert.match(navigationTypes, /FeaturedVisitors: undefined;/);
  assert.match(navigationTypes, /PromotionList: undefined;/);
  assert.match(navigationTypes, /AIAssistant: undefined;/);
  assert.match(navigationTypes, /MerchantSettings: undefined;/);
});

test("Merchant screen contract: menu management screens are wired to merchant services", () => {
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  const dishEditor = read("src/app/screens/merchant/DishEditorScreen.tsx");
  const ocrDrafts = read("src/app/screens/merchant/OCRDraftScreen.tsx");

  assert.match(menu, /merchant\.getMenu\(/);
  assert.match(menu, /merchant\.toggleSoldOut\(/);
  assert.match(menu, /merchant\.toggleFeatured\(/);
  assert.match(menu, /merchant\.deleteDish\(/);
  assert.match(menu, /navigate\("DishEditor"/);
  assert.match(menu, /navigate\("OCRDrafts"\)/);

  assert.match(dishEditor, /merchant\.addDish\(/);
  assert.match(dishEditor, /merchant\.editDish\(/);
  assert.match(dishEditor, /parseMerchantPrice/);
  assert.match(dishEditor, /updateMerchantAvailability/);
  assert.match(dishEditor, /launchImageLibraryAsync/);
  assert.doesNotMatch(
    dishEditor,
    /merchant\.(?:suggestAllergens|generateDishDescription|suggestIngredients)\(/,
  );
  assert.match(dishEditor, /imageUrl/);
  assert.match(dishEditor, /dietaryFlags/);

  assert.match(ocrDrafts, /merchant\.getOCRDrafts\(/);
  assert.match(ocrDrafts, /merchant\.acceptOCRDraft\(/);
  assert.match(ocrDrafts, /merchant\.rejectOCRDraft\(/);
  assert.match(ocrDrafts, /navigate\("DishEditor"/);
  assert.match(ocrDrafts, /Edit before adding/);
});

test("Merchant screen contract: profile, menu, and analytics use production-ready controls", () => {
  const profile = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  const verificationCentre = read("src/app/screens/merchant/VerificationCentreScreen.tsx");
  const homeBasedVerification = read("src/app/screens/merchant/HomeBasedVerificationScreen.tsx");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  const analytics = read("src/app/screens/merchant/MerchantAnalyticsScreen.tsx");
  const dashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");

  assert.match(profile, /BusinessTypeDropdown/);
  assert.match(profile, /launchImageLibraryAsync/);
  assert.match(profile, /BusinessImageField/);
  assert.doesNotMatch(profile, /Profile image upload unavailable/);
  assert.match(verificationCentre, /launchImageLibraryAsync/);
  assert.match(verificationCentre, /submitVerification\(\s*activeOutlet\.id/);
  assert.match(homeBasedVerification, /launchImageLibraryAsync/);
  assert.match(homeBasedVerification, /photoUris\.map\(\(fileUrl\)/);
  assert.match(homeBasedVerification, /submitVerification\(\s*activeOutlet\.id/);
  assert.doesNotMatch(`${verificationCentre}\n${homeBasedVerification}`, /mock-url:\/\//);
  assert.doesNotMatch(`${verificationCentre}\n${homeBasedVerification}`, /Mock photos|Attach mock/);
  const submitVerification = segmentBetween(
    supabaseService,
    "async submitVerification(outletId, evidence)",
    "async resubmitVerification",
  );
  assert.ok(submitVerification);
  assert.ok(
    submitVerification.indexOf("assertLocalUserMediaUri") <
      submitVerification.indexOf('.from("merchant_verifications")'),
    "verification evidence must be validated before a verification row can be written",
  );
  assert.ok(
    submitVerification.indexOf('"merchant_submit_verification_v2"') >
      submitVerification.indexOf('.from("merchant_verification_evidence").insert'),
    "verification status must become submitted only after evidence insert is attempted",
  );
  assert.match(menu, /title="Menu"/);
  assert.match(menu, /<FAB>/);
  assert.match(menu, /Add Menu Item Manually/);
  assert.match(menu, /Search menu/);
  assert.match(analytics, /showsVerticalScrollIndicator=\{false\}/);
  assert.match(analytics, /See More/);
  assert.match(dashboard, /getMerchantProfileGaps/);
  assert.match(dashboard, /getUnrepliedReviews/);
  assert.doesNotMatch(dashboard, /Hello,/);
  assert.doesNotMatch(dashboard, /STALL IS LIVE & DISCOVERABLE/);
});

test("Merchant screen contract: dish details record merchant dish views once per screen", () => {
  const detailV2 = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(detailV2, /recordDishView/);
  assert.match(detailV2, /lastRecordedDishViewId/);
});

test("Merchant screen contract: inbox, promotions, assistant, and settings screens use merchant services", () => {
  const inbox = read("src/app/screens/merchant/CustomerInboxScreen.tsx");
  const featuredVisitors = read("src/app/screens/merchant/FeaturedVisitorsScreen.tsx");
  const promotionList = read("src/app/screens/merchant/PromotionListScreen.tsx");
  const promotionBuilder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  const assistant = read("src/app/screens/merchant/AIAssistantScreen.tsx");
  const settings = read("src/app/screens/merchant/MerchantSettingsScreen.tsx");

  assert.match(inbox, /merchant\.getInbox\(/);
  assert.match(inbox, /merchant\.replyToInteraction\(/);
  assert.match(inbox, /merchant\.reportInteraction\(/);
  assert.doesNotMatch(inbox, /merchant\.generateAIReply\(/);
  assert.match(inbox, /sourceDishId/);
  assert.match(inbox, /writeMerchantReplyDraft/);
  assert.match(inbox, /usePreventRemove/);
  assert.match(inbox, /onViewOriginal/);

  assert.match(featuredVisitors, /merchant\.listPopularVisitorPins\(/);
  assert.match(featuredVisitors, /merchant\.listPopularVisitorCandidates\(/);
  assert.match(featuredVisitors, /merchant\.pinPopularVisitor\(/);
  assert.match(featuredVisitors, /merchant\.unpinPopularVisitor\(/);
  assert.match(featuredVisitors, /merchant\.reorderPopularVisitorPins\(/);

  assert.match(promotionList, /merchant\.getPromotions\(/);
  assert.match(promotionList, /navigate\("PromotionBuilder"/);
  assert.match(promotionBuilder, /merchant\.getPromotions\(/);
  assert.match(promotionBuilder, /merchant\.createPromotion\(/);
  assert.match(promotionBuilder, /merchant\.updatePromotion\(/);
  assert.match(promotionBuilder, /promotionItemType/);
  assert.match(promotionBuilder, /originalPrice/);
  assert.match(promotionBuilder, /isAvailable/);

  assert.match(assistant, /merchant\.getAIInsights\(/);
  assert.match(assistant, /data\.find\(.*weekly_summary/);
  assert.doesNotMatch(assistant, /merchant\.getWeeklySummary\(/);

  assert.match(settings, /merchant\.getTeamMembers\(/);
  assert.match(settings, /merchant\.getMerchantNotifications\(/);
  assert.match(settings, /merchant\.getWeeklySummaryStats\(/);
  assert.match(settings, /merchant\.sendWeeklySummaryNotifications\(/);
  assert.match(settings, /merchant\.syncLowRatingNotifications\(/);
  assert.match(settings, /merchant\.getNotificationPreferences\(/);
  assert.match(settings, /merchant\.updateNotificationPreferences\(/);
  assert.match(settings, /merchant\.removeTeamMember\(/);
});

test("Merchant screen contract: merchant screens resolve services through provider", () => {
  const serviceBackedScreens = merchantScreens.filter(
    (screen) => !["Dashboard", "Analytics", "Profile", "OrdersComingSoon"].includes(screen.route),
  );

  for (const screen of serviceBackedScreens) {
    const source = read(screen.file);
    assert.doesNotMatch(source, /lib\/services\/mock\/mockService/);
    assert.match(source, /getHungryService/);
  }

  const dishEditor = read("src/app/screens/merchant/DishEditorScreen.tsx");
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  assert.match(dishEditor, /hasAvailabilityFlag/);
  assert.doesNotMatch(dishEditor, /as any/);
  assert.match(menu, /hasAvailabilityFlag/);
});
