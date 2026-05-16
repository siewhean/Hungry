import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("high-risk visible actions are not wired as no-ops or coming-soon alerts", () => {
  const stallInteractionBar = read("src/components/stall/StallInteractionBar.tsx");
  const mediaEditor = read("src/features/post/components/MediaEditor.tsx");
  const reviewTab = read("src/features/post/components/ReviewTab.tsx");
  const businessProfileEditor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  const ordersComingSoon = read("src/app/screens/merchant/OrdersComingSoonScreen.tsx");

  assert.doesNotMatch(stallInteractionBar, /onAddToCollection \?\? \(\(\) => \{\}\)/);
  assert.match(stallInteractionBar, /\.\.\.\(onAddToCollection/);

  assert.doesNotMatch(mediaEditor, /onPress=\{\(\) => Haptics\.impactAsync/);
  assert.doesNotMatch(mediaEditor, /Apply AI Auto-Crop/);
  assert.match(mediaEditor, /updateMediaAdjustment/);
  assert.match(mediaEditor, /handleAutoEnhance/);
  assert.match(mediaEditor, /handleLightAdjustment/);
  assert.match(mediaEditor, /handleColourAdjustment/);

  assert.match(reviewTab, /HASHTAG_SUGGESTIONS/);
  assert.match(reviewTab, /setSuggestionOffset/);
  assert.match(reviewTab, /onPress=\{handleRefreshHashtags\}/);

  assert.doesNotMatch(businessProfileEditor, /Photo upload coming soon|Cover upload coming soon/);
  assert.match(businessProfileEditor, /BusinessImageField/);
  assert.match(businessProfileEditor, /launchImageLibraryAsync/);

  assert.doesNotMatch(
    ordersComingSoon,
    /Registration coming soon|PDF mockup generation coming soon/,
  );
  assert.match(ordersComingSoon, /Pilot Program Unavailable/);
  assert.match(ordersComingSoon, /disabled/);
});

test("mode presets keep developer data mock-only and user data supabase-backed", () => {
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const serviceProvider = read("src/lib/services/serviceProvider.ts");

  assert.match(serviceProvider, /export function setMockServiceProvider/);
  assert.match(serviceProvider, /export function setSupabaseServiceProvider/);
  assert.match(developerLauncher, /const enterDeveloperMode[\s\S]*setMockServiceProvider\(\)/);
  assert.match(developerLauncher, /const enterMerchantMode[\s\S]*setMockServiceProvider\(\)/);
  assert.match(developerLauncher, /const enterUserMode[\s\S]*setSupabaseServiceProvider\(\)/);
  assert.doesNotMatch(developerLauncher, /const enterUserMode[\s\S]*resetServiceProvider\(\)/);
});

test("web persistence has a browser localStorage fallback before in-memory fallback", () => {
  const persistStorage = read("src/store/persistStorage.ts");
  const secureStorage = read("src/store/secureStorage.ts");
  const mockPersistence = read("src/lib/services/mock/persistence.ts");

  assert.match(persistStorage, /function getBrowserStorage\(\)/);
  assert.match(persistStorage, /window\.localStorage/);
  assert.match(secureStorage, /function getBrowserStorage\(\)/);
  assert.match(secureStorage, /window\.localStorage/);
  assert.match(mockPersistence, /window\.localStorage/);
});

test("secure browser persistence is limited to local web test runtimes", () => {
  const secureStorage = read("src/store/secureStorage.ts");

  assert.match(secureStorage, /isLocalWebRuntime/);
  assert.match(secureStorage, /window\.location\.hostname === "localhost"/);
  assert.match(secureStorage, /process\.env\.NODE_ENV === "test"/);
});

test("stall interaction loading flags clear after async failures", () => {
  const stallInteractionBar = read("src/components/stall/StallInteractionBar.tsx");

  assert.match(stallInteractionBar, /try \{[\s\S]*await toggleSaved\(userId, stallId\)/);
  assert.match(stallInteractionBar, /finally \{[\s\S]*setSavingInProgress\(false\)/);
  assert.match(stallInteractionBar, /try \{[\s\S]*await markTried\(userId, stallId\)/);
  assert.match(stallInteractionBar, /finally \{[\s\S]*setTryingInProgress\(false\)/);
});

test("passport card is visible for authenticated profile surfaces", () => {
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(profileHome, /import \{ PassportCard \}/);
  assert.match(
    profileHome,
    /<PassportCard[\s\S]*onPressIn=\{\(\) => preloadRoute\(rootNavigation, "PassportScreen"\)\}/,
  );
  assert.match(profileHome, /onPress=\{\(\) => rootNavigation\.navigate\("PassportScreen"\)\}/);
});

test("merchant audience switches set explicit values instead of double toggling", () => {
  const promotionBuilder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");

  assert.match(promotionBuilder, /const setAudienceSelected =/);
  assert.match(promotionBuilder, /onPress=\{\(\) => setAudienceSelected\(id, !isSelected\)\}/);
  assert.match(promotionBuilder, /onValueChange=\{\(value\) => setAudienceSelected\(id, value\)\}/);
  assert.doesNotMatch(promotionBuilder, /onValueChange=\{\(\) => toggleAudience\(id\)\}/);
});

test("stall detail protected actions route signed-out users to auth with return route", () => {
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(
    stallDetail,
    /const setReturnRoute = useSessionStore\(\(state\) => state\.setReturnRoute\)/,
  );
  assert.match(stallDetail, /const requireAuthForProtectedAction = \(message: string\) =>/);
  assert.match(
    stallDetail,
    /setReturnRoute\(\{[\s\S]*name: "StallDetail"[\s\S]*params: \{ venueId: venue\?\.id \?\? venueId \}/,
  );
  assert.match(stallDetail, /navigation\.navigate\("AuthStack", \{ screen: "Login" \}\)/);
  assert.match(stallDetail, /Sign in to reply to this review\./);
  assert.match(stallDetail, /Sign in before claiming this stall\./);
  assert.match(stallDetail, /Sign in to save this stall\./);
  assert.doesNotMatch(stallDetail, /Sign in to order from this stall\./);
  assert.doesNotMatch(stallDetail, /StickyBottomBar/);
  assert.match(
    stallDetail,
    /if \(!requireAuthForProtectedAction\("Sign in before claiming this stall\."\)\)/,
  );
});
