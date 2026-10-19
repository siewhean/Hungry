import test from "node:test";

import {
  assertRepoFileExists,
  assertSourceExcludes,
  assertSourceIncludes,
  readRepoFile,
} from "@/test/sourceContracts";

test("merchant access, dashboard, and tab routes cover primary merchant entry points", () => {
  const launcher = readRepoFile("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const tabs = readRepoFile("src/app/navigation/MerchantTabs.tsx");
  const guards = readRepoFile("src/features/merchant/merchantGuards.ts");
  const dashboard = readRepoFile("src/app/screens/merchant/MerchantDashboardScreen.tsx");

  assertSourceIncludes(
    launcher,
    [
      /const enterMerchantMode = \(\) =>/,
      /setMockServiceProvider\(\)/,
      /setMerchantAccount\(JSON\.parse\(JSON\.stringify\(getMockData\(\)\.merchantAccount\)\)\)/,
      /navigation\.navigate\("MerchantTabs" as any\)/,
      /label="Merchant"/,
    ],
    "DeveloperLauncher merchant preset",
  );
  assertSourceIncludes(
    tabs,
    [
      /resolveMerchantAccess/,
      /MerchantAccessGate/,
      /developerMerchantMode/,
      /initialRouteName=\{access === "verified" \? "Dashboard" : "VerificationCentre"\}/,
      /name="Dashboard"/,
      /name="Menu"/,
      /name="Analytics"/,
      /name="Profile"/,
      /name="CustomerInbox"/,
      /name="BusinessProfileEditor"/,
      /name="DishEditor"/,
      /name="OCRDrafts"/,
      /name="FeaturedVisitors"/,
      /name="PromotionList"/,
      /name="PromotionBuilder"/,
      /name="AIAssistant"/,
      /name="MerchantSettings"/,
    ],
    "MerchantTabs route contract",
  );
  assertSourceIncludes(
    guards,
    [
      /"Dashboard"/,
      /"Menu"/,
      /"CustomerInbox"/,
      /"FeaturedVisitors"/,
      /"PromotionBuilder"/,
      /"MerchantSettings"/,
    ],
    "merchant verified-only guards",
  );
  assertSourceIncludes(
    dashboard,
    [
      /service\.merchant\.getAnalytics/,
      /navigation\.navigate\("BusinessProfileEditor"\)/,
      /navigation\.navigate\("CustomerInbox"\)/,
      /navigation\.navigate\("FeaturedVisitors"\)/,
      /navigation\.navigate\("Menu"\)/,
      /Manage Menu/,
      /Recent Reviews/,
      /Featured Visitors/,
      /Actionable Insights/,
    ],
    "merchant dashboard actions",
  );
});

test("merchant profile edits validate fields and propagate to user-side venue reads", () => {
  const editor = readRepoFile("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  const validation = readRepoFile("src/features/merchant/profileValidation.ts");
  const mockService = readRepoFile("src/lib/services/mock/mockService.ts");
  const serviceTests = readRepoFile("src/lib/services/mock/service-methods.test.ts");

  assertSourceIncludes(
    editor,
    [
      /name="name"/,
      /name="description"/,
      /name="operatingHours"/,
      /name="temporaryClosure"/,
      /name="contactPhone"/,
      /name="contactEmail"/,
      /updateBusinessProfile/,
      /handlePreviewAsCustomer/,
      /Preview/,
      /<MerchantImageField/,
      /name="websiteUrl"|LINK_FIELDS/,
    ],
    "BusinessProfileEditorScreen",
  );
  assertSourceIncludes(
    readRepoFile("src/components/merchant/MerchantImageField.tsx"),
    [/launchImageLibraryAsync/],
    "MerchantImageField",
  );
  assertSourceIncludes(
    validation,
    [
      /validateMerchantProfileUpdates/,
      /Business name cannot be empty/,
      /Description must be/,
      /Temporary closure notice must be/,
      /Contact email format is invalid/,
      /Contact phone format is invalid/,
    ],
    "merchant profile validation",
  );
  assertSourceIncludes(
    mockService,
    [
      /validateMerchantProfileUpdates\(updates\)/,
      /syncMerchantOutletToUserCatalog\(outlet\)/,
      /closureNotice: outlet\.temporaryClosure/,
      /deliveryLinks: outlet\.deliveryLinks/,
    ],
    "mock merchant profile propagation",
  );
  assertSourceIncludes(
    serviceTests,
    [
      /merchant profile updates are visible from mock user venue reads/,
      /discovery\.getVenue\(userVisibleVenueId\)/,
      /discovery\.getDish\(seededDish\.id\)/,
    ],
    "merchant profile propagation tests",
  );
});

test("merchant menu and OCR flows cover catalog writes that become consumer-visible dishes", () => {
  const menu = readRepoFile("src/app/screens/merchant/MerchantMenuScreen.tsx");
  const dishEditor = readRepoFile("src/app/screens/merchant/DishEditorScreen.tsx");
  const ocr = readRepoFile("src/app/screens/merchant/OCRDraftScreen.tsx");
  const mockService = readRepoFile("src/lib/services/mock/mockService.ts");
  const serviceTests = readRepoFile("src/lib/services/mock/service-methods.test.ts");
  const supabaseLinkage = readRepoFile("src/lib/services/supabase/merchant-linkage.test.ts");

  assertSourceIncludes(
    menu,
    [
      /merchant\.getMenu\(/,
      /merchant\.toggleSoldOut\(/,
      /merchant\.toggleFeatured\(/,
      /merchant\.deleteDish\(/,
      /navigation\.navigate\("DishEditor"/,
      /navigation\.navigate\("OCRDrafts"\)/,
      /handlePreviewMenuAsCustomer/,
      /rootNavigation\.navigate\("StallDetail", \{ venueId: previewVenueId \}\)/,
    ],
    "MerchantMenuScreen",
  );
  assertSourceExcludes(
    menu,
    [/rootNavigation\.navigate\("DiscoverMap"\)/],
    "menu preview map fallback",
  );
  assertSourceIncludes(
    dishEditor,
    [
      /merchant\.addDish\(/,
      /merchant\.editDish\(/,
      /imageUrl/,
      /gallery/,
      /description/,
      /price/,
      /dietaryFlags/,
      /tasteVector/,
      /merchant\.generateDishDescription\(/,
      /merchant\.suggestIngredients\(/,
      /merchant\.suggestAllergens\(/,
      /merchant\.suggestTags\(/,
    ],
    "DishEditorScreen",
  );
  assertSourceIncludes(
    ocr,
    [
      /merchant\.getOCRDrafts\(/,
      /merchant\.acceptOCRDraft\(/,
      /merchant\.rejectOCRDraft\(/,
      /Edit before adding/,
      /sourcePhotoUrl/,
      /confidence/,
    ],
    "OCRDraftScreen",
  );
  assertSourceIncludes(
    mockService,
    [
      /function buildMerchantDish\(outletId: string, input: Partial<DishDetail>\)/,
      /id: input\.id \?\? `merchant-dish-\$\{\+\+_merchantDishCounter\}`/,
      /syncMerchantDishToUserCatalog/,
      /syncMerchantOutletToUserCatalog/,
      /deleteDish\(outletId, dishId\)/,
      /acceptOCRDraft\(draftId, edits\)/,
    ],
    "mock merchant catalog propagation",
  );
  assertSourceIncludes(
    serviceTests,
    [
      /merchant menu methods persist CRUD and status toggles in mock state/,
      /merchant seeded menu edits do not overwrite original mock catalog fixtures/,
      /merchant OCR draft methods filter drafts and publish accepted dishes/,
    ],
    "mock catalog service tests",
  );
  assertSourceIncludes(
    supabaseLinkage,
    [
      /Supabase merchant dish writes persist user-visible metadata and media/,
      /Supabase repository reads dish metadata from normalized catalog tables/,
      /dish_images/,
      /dish_dietary_flags/,
      /dish_taste_vectors/,
    ],
    "Supabase merchant linkage tests",
  );
});

test("merchant inbox, promotions, AI assistant, and settings use service-backed state", () => {
  const inbox = readRepoFile("src/app/screens/merchant/CustomerInboxScreen.tsx");
  const featuredVisitors = readRepoFile("src/app/screens/merchant/FeaturedVisitorsScreen.tsx");
  const promotionList = readRepoFile("src/app/screens/merchant/PromotionListScreen.tsx");
  const promotionBuilder = readRepoFile("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  const assistant = readRepoFile("src/app/screens/merchant/AIAssistantScreen.tsx");
  const settings = readRepoFile("src/app/screens/merchant/MerchantSettingsScreen.tsx");
  const serviceTests = readRepoFile("src/lib/services/mock/service-methods.test.ts");

  assertSourceIncludes(
    inbox,
    [
      /merchant\.getInbox\(/,
      /merchant\.replyToInteraction\(/,
      /merchant\.reportInteraction\(/,
      /merchant\.generateAIReply\(/,
      /<Modal visible transparent/,
      /<KeyboardAvoidingView/,
      /Your reply is public/,
      /accessibilityLabel="Close reply composer"/,
    ],
    "CustomerInboxScreen",
  );
  assertSourceIncludes(
    featuredVisitors,
    [
      /merchant\.listPopularVisitorPins\(/,
      /merchant\.listPopularVisitorCandidates\(/,
      /merchant\.pinPopularVisitor\(/,
      /merchant\.unpinPopularVisitor\(/,
      /merchant\.reorderPopularVisitorPins\(/,
    ],
    "FeaturedVisitorsScreen",
  );
  assertSourceIncludes(
    promotionList,
    [
      /merchant\.getPromotions\(/,
      /filter, setFilter/,
      /navigation\.navigate\("PromotionBuilder"/,
      /accessibilityLabel="Create promotion"/,
    ],
    "PromotionListScreen",
  );
  assertSourceIncludes(
    promotionBuilder,
    [
      /merchant\.getPromotions\(/,
      /merchant\.createPromotion\(/,
      /merchant\.updatePromotion\(/,
      /if \(!title \|\| !description \|\| !startDate \|\| !endDate\)/,
      /dateRegex\.test\(startDate\)/,
      /dateRegex\.test\(endDate\)/,
      /toSingaporePromotionBoundary\(startDate, "start"\)/,
      /toSingaporePromotionBoundary\(endDate, "end"\)/,
      /targetDishId/,
      /resolvePromotionRuntimeStatus/,
      /status: newStatus/,
    ],
    "PromotionBuilderScreen",
  );
  assertSourceExcludes(promotionBuilder, [/as any/], "PromotionBuilderScreen typed writes");
  assertSourceIncludes(
    assistant,
    [
      /merchant\.getAIInsights\(/,
      /merchant\.getWeeklySummary\(/,
      /navigation\.navigate\("PromotionBuilder"\)/,
      /navigation\.navigate\("Menu"\)/,
      /navigation\.navigate\("BusinessProfileEditor"\)/,
    ],
    "AIAssistantScreen",
  );
  assertSourceIncludes(
    settings,
    [
      /merchant\.getMerchantNotifications\(/,
      /merchant\.getWeeklySummaryStats\(/,
      /merchant\.syncLowRatingNotifications\(/,
      // Low-rating push alerts are real (reviews trigger -> notification_jobs -> send-notifications).
      /merchant\.getNotificationPreferences\(/,
      /merchant\.updateNotificationPreferences\(account\.id, \{\s*lowRatingAlerts: enabled,/,
      /label="Low-rating push alerts"/,
      /registerForStallAlerts\(\{ askPermission: false \}\)/,
      /Hungry sends low-rating push alerts to the account owner as soon as the review is/,
      // Preferences failing to load must not take the alerts list down with them.
      /\.getNotificationPreferences\(account\.id\)\s*\.catch\(\(\) => null\)/,
      /registerForStallAlerts\(\)\.catch\(\(\) => false\)/,
      // Web cannot register for push, so it never offers "Allow notifications".
      /Platform\.OS !== "web" && !isDeviceRegistered/,
      /Low-rating alerts go to the Hungry app on your phone\./,
      /Email alerts and weekly emails are not sent\./,
    ],
    "MerchantSettingsScreen",
  );
  // Team invites and weekly emails are not delivered, so they stay hidden.
  assertSourceExcludes(
    settings,
    [
      /merchant\.addTeamMember\(/,
      /merchant\.sendWeeklySummaryNotifications\(/,
      /Hungry does not send push or email alerts/,
      /weeklyDigest/,
      /Immediate alert/,
      /Weekly email summary/,
      /Send weekly summary/,
    ],
    "MerchantSettingsScreen hidden fake features",
  );
  assertSourceIncludes(
    serviceTests,
    [
      /merchant inbox filters interactions by outlet, type, and unreplied status/,
      /merchant inbox reply and report methods validate input and persist replies/,
      /merchant promotion create and update persist mock state/,
      /merchant popular visitor pins stay review-backed, capped, reorderable, and venue-filtered/,
      /merchant settings team methods validate duplicates and protected owner role/,
      /merchant settings notification preferences persist partial updates/,
      /merchant AI assistant returns insight slices and weekly summary/,
    ],
    "merchant service coverage tests",
  );
});

test("merchant Playwright and native smoke coverage entry points stay registered", () => {
  assertRepoFileExists("tests/e2e/merchant-catalog.spec.ts");
  assertRepoFileExists("src/app/native-smoke-contracts.test.ts");

  const packageJson = readRepoFile("package.json");
  const nativeContracts = readRepoFile("src/app/native-smoke-contracts.test.ts");
  const e2e = readRepoFile("tests/e2e/merchant-catalog.spec.ts");

  assertSourceIncludes(
    packageJson,
    [/"test:e2e": "playwright test"/, /"smoke:native:ios:prepared"/],
    "package scripts",
  );
  assertSourceIncludes(
    e2e,
    [
      /test\.describe\("merchant catalog"/,
      /clickDevButton\(page, "Merchant"/,
      /getByText\("Manage Menu"/,
      /getByText\("Menu"/,
      /getByRole\("button", \{ name: "Add menu item" \}\)/,
    ],
    "merchant Playwright coverage",
  );
  assertSourceIncludes(
    nativeContracts,
    [
      /native media and interaction flows remain available as explicit authenticated targets/,
      /native source-smoke coverage still includes gestures and keyboard-aware sheets/,
    ],
    "native smoke coverage contract",
  );
});
