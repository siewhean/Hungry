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

test("Merchant screen contract: merchant route params match editable sub-screen needs", () => {
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");

  assert.match(navigationTypes, /DishEditor: \{ dishId\?: string \} \| undefined;/);
  assert.match(navigationTypes, /PromotionBuilder: \{ promotionId\?: string \} \| undefined;/);
  assert.match(navigationTypes, /OCRDrafts: undefined;/);
  assert.match(navigationTypes, /CustomerInbox: undefined;/);
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
  assert.match(dishEditor, /merchant\.generateDishDescription\(/);
  assert.match(dishEditor, /merchant\.suggestIngredients\(/);
  assert.match(dishEditor, /merchant\.suggestAllergens\(/);
  assert.match(dishEditor, /imageUrl/);
  assert.match(dishEditor, /dietaryFlags/);

  assert.match(ocrDrafts, /merchant\.getOCRDrafts\(/);
  assert.match(ocrDrafts, /merchant\.acceptOCRDraft\(/);
  assert.match(ocrDrafts, /merchant\.rejectOCRDraft\(/);
  assert.match(ocrDrafts, /navigate\("DishEditor"/);
  assert.match(ocrDrafts, /Edit before adding/);
});

test("Merchant screen contract: inbox, promotions, assistant, and settings screens use merchant services", () => {
  const inbox = read("src/app/screens/merchant/CustomerInboxScreen.tsx");
  const promotionList = read("src/app/screens/merchant/PromotionListScreen.tsx");
  const promotionBuilder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  const assistant = read("src/app/screens/merchant/AIAssistantScreen.tsx");
  const settings = read("src/app/screens/merchant/MerchantSettingsScreen.tsx");

  assert.match(inbox, /merchant\.getInbox\(/);
  assert.match(inbox, /merchant\.replyToInteraction\(/);
  assert.match(inbox, /merchant\.reportInteraction\(/);
  assert.match(inbox, /merchant\.generateAIReply\(/);
  assert.match(inbox, /onViewOriginal/);

  assert.match(promotionList, /merchant\.getPromotions\(/);
  assert.match(promotionList, /navigate\("PromotionBuilder"/);
  assert.match(promotionBuilder, /merchant\.getPromotions\(/);
  assert.match(promotionBuilder, /merchant\.createPromotion\(/);
  assert.match(promotionBuilder, /merchant\.updatePromotion\(/);

  assert.match(assistant, /merchant\.getAIInsights\(/);
  assert.match(assistant, /merchant\.getWeeklySummary\(/);

  assert.match(settings, /merchant\.getTeamMembers\(/);
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
