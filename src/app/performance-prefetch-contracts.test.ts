import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("root navigation keeps heavy routes lazy-loaded", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");

  assert.doesNotMatch(rootNavigator, /import \{ HomeMapScreen \}/);
  assert.doesNotMatch(rootNavigator, /import \{ PostComposerScreenV2 \}/);
  assert.doesNotMatch(rootNavigator, /import \{ MerchantTabs \}/);
  assert.match(rootNavigator, /getComponent=\{loadHomeMapScreen\}/);
  assert.match(rootNavigator, /getComponent=\{loadMerchantTabs\}/);
  assert.match(rootNavigator, /getComponent=\{loadPostComposerScreenV2\}/);
  assert.match(rootNavigator, /QuickReviewModalHost/);
  assert.match(rootNavigator, /ReviewSuccessModalHost/);

  assert.doesNotMatch(tabs, /import \{ DiscoverHomeScreen \}/);
  assert.doesNotMatch(tabs, /import \{ ReviewFeedScreen \}/);
  assert.doesNotMatch(tabs, /import \{ ProfileStack \}/);
  assert.match(tabs, /lazy:\s*true/);
  assert.match(tabs, /lazyPlaceholder:\s*TabLazyPlaceholder/);
  assert.match(tabs, /InteractionManager\.runAfterInteractions/);
  assert.match(tabs, /tabPreloadEnabled/);
  assert.match(tabs, /lazyPreloadDistance:\s*tabPreloadEnabled \? 1 : 0/);
});

test("startup does not block indefinitely on fonts or analytics", () => {
  const appBody = read("src/app/AppBody.tsx");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(appBody, /APP_SHELL_FONT_GRACE_MS = 900/);
  assert.match(appBody, /fontGraceReached/);
  assert.doesNotMatch(appBody, /Font load delayed/);
  assert.match(bootstrap, /InteractionManager\.runAfterInteractions/);
  assert.match(bootstrap, /EXPO_PUBLIC_POSTHOG_API_KEY/);
  assert.match(bootstrap, /require\("@\/lib\/analytics\/posthogSink"\)/);
  assert.doesNotMatch(bootstrap, /import \{ posthogSink \}/);
});

test("startup defers profile, mock data, and native analytics module loading", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  const sessionStore = read("src/store/useSessionStore.ts");
  const serviceProvider = read("src/lib/services/serviceProvider.ts");

  assert.doesNotMatch(bootstrap, /import \{ useProfileStore \}/);
  assert.match(bootstrap, /require\("@\/store\/useProfileStore"\)/);

  assert.doesNotMatch(sessionStore, /import \{ useProfileStore \}/);
  assert.doesNotMatch(sessionStore, /from "@\/lib\/analytics\/posthogSink"/);
  assert.match(sessionStore, /require\("\.\/useProfileStore"\)/);
  assert.match(sessionStore, /require\("@\/lib\/analytics\/posthogSink"\)/);
  assert.match(sessionStore, /shouldEnablePostHogIdentity/);

  assert.match(serviceProvider, /let activeProvider: ServiceProvider \| null = null/);
  assert.match(serviceProvider, /function getActiveProvider/);
  assert.match(serviceProvider, /activeProvider = createProviderFromEnv\(\)/);
  assert.doesNotMatch(
    serviceProvider,
    /let activeProvider: ServiceProvider = createProviderFromEnv\(\)/,
  );
});

test("home, discover, and quick bites avoid duplicate render-time data work", () => {
  const homeFeed = read("src/features/home/feed.ts");
  const homeScreen = read("src/app/screens/home/HomeFeedScreen.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");

  assert.match(homeFeed, /export interface HomeFeedBundle/);
  assert.match(homeFeed, /export async function getHomeFeedBundle/);
  assert.match(homeScreen, /getHomeFeedBundle\(profile\)/);
  assert.doesNotMatch(homeScreen, /getHomeFeed\(profile\)/);
  assert.doesNotMatch(homeScreen, /getHomeSocialFeed\(profile\)/);
  assert.doesNotMatch(homeScreen, /useEffect\(\(\) => \{\s*void loadFeed\(\);/);
  assert.match(homeScreen, /InteractionManager\.runAfterInteractions/);
  assert.match(homeScreen, /FEED_LOAD_DEDUPE_MS = 1500/);
  assert.match(homeScreen, /lastLoadedFeedKeyRef/);
  assert.match(homeScreen, /lastLoadedFeedAtRef/);
  assert.match(homeScreen, /activeFeedLoadIdRef/);
  assert.doesNotMatch(homeScreen, /const publishedPosts = usePublishedPostStore/);
  assert.match(discover, /getDiscoverBites\(repository\)/);
  assert.match(discover, /getDiscoverBiteCollections\(discoverBaseBites, repository\)/);
  assert.match(discover, /const discoverDishById = useMemo/);
  assert.match(discover, /discoverDishById\.get\(bite\.dishId\)/);
  assert.doesNotMatch(discover, /getDiscoverBiteCollection\("quickBites"/);
  assert.equal((quickBites.match(/getDiscoverBites\(/g) ?? []).length, 1);
  assert.match(quickBites, /const fallbackBites = useMemo\(\(\) => getDiscoverBites\(\), \[\]\)/);
  assert.doesNotMatch(quickBites, /ActivityIndicator/);
  assert.doesNotMatch(quickBites, /isLoading/);
});

test("prefetch layer warms images, data, and route modules without blocking navigation", () => {
  const prefetch = read("src/features/navigation/prefetch.ts");
  const homeScreen = read("src/app/screens/home/HomeFeedScreen.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const search = read("src/app/screens/search/SearchResultsScreen.tsx");
  const searchResultsView = read("src/components/discover/SearchResultsView.tsx");
  const merchantTabs = read("src/app/navigation/MerchantTabs.tsx");
  const zoomableMedia = read("src/components/social/ZoomableMedia.tsx");
  const zoomableVideo = read("src/components/social/ZoomableVideo.tsx");

  assert.match(prefetch, /ExpoImage\.prefetch/);
  assert.match(prefetch, /const prefetchedDishDetails = new Set<string>\(\)/);
  assert.match(prefetch, /const prefetchedStallDetails = new Set<string>\(\)/);
  assert.match(prefetch, /export function prefetchDishDetail/);
  assert.match(prefetch, /export function prefetchStallDetail/);
  assert.match(prefetch, /export function prefetchPostDetail/);
  assert.match(prefetch, /export function preloadRoute/);
  assert.match(prefetch, /"preload" in navigation/);
  assert.match(prefetch, /export function prefetchMerchantTab/);
  assert.match(homeScreen, /onPressIn=\{\(\) => prefetchFeedCardRoute\(item\)\}/);
  assert.match(discover, /onPressIn=\{\(\) => prefetchBiteCard\(bite\)\}/);
  assert.match(search, /onPressIn=\{\(\) =>/);
  assert.match(search, /const browsePostIndexes = useMemo/);
  assert.match(search, /postByDishId\.get\(dish\.id\)/);
  assert.match(search, /postByVenueId\.get\(venue\.id\)/);
  assert.doesNotMatch(search, /stallPosts\.find/);
  assert.doesNotMatch(search, /results\.slice\(0, 8\)\.forEach/);
  assert.doesNotMatch(search, /filteredFeedItems\.slice\(0, 8\)\.forEach/);
  assert.match(searchResultsView, /import \{ FlashList \} from "@shopify\/flash-list"/);
  assert.match(searchResultsView, /renderItem=\{renderResult\}/);
  assert.doesNotMatch(searchResultsView, /results\.map/);
  assert.match(merchantTabs, /prefetchMerchantTab\(route\.name/);
  assert.doesNotMatch(zoomableMedia, /from "expo-video"/);
  assert.match(zoomableMedia, /require\("\.\/ZoomableVideo"\)/);
  assert.match(zoomableVideo, /from "expo-video"/);
});

test("remaining high-traffic profile, developer, and merchant links prefetch on intent", () => {
  const button = read("src/components/ui/Button.tsx");
  const iconButton = read("src/components/ui/IconButton.tsx");
  const merchantDashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  const merchantMenu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const socialPostDetail = read("src/app/screens/profile/SocialPostDetailScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const prefetch = read("src/features/navigation/prefetch.ts");

  assert.match(button, /onPressIn\?\.\(event\)/);
  assert.match(iconButton, /onPressIn\?\.\(event\)/);

  assert.match(merchantDashboard, /function ActionCard[\s\S]*onPressIn\?: \(\) => void/);
  assert.match(merchantDashboard, /const prefetchMerchantRoute = useCallback/);
  assert.match(merchantDashboard, /prefetchMerchantTab\(routeName, activeOutlet\?\.id/);
  assert.match(prefetch, /routeName === "BusinessProfileEditor"/);
  assert.match(prefetch, /routeName === "VerificationCentre"/);
  assert.match(prefetch, /await merchant\.getMerchantAccount\(\)/);
  assert.match(merchantDashboard, /onPressIn=\{\(\) => prefetchMerchantRoute\("Menu"\)\}/);
  assert.match(merchantDashboard, /onPressIn=\{\(\) => prefetchMerchantRoute\("CustomerInbox"\)\}/);
  assert.match(
    merchantDashboard,
    /onPressIn=\{\(\) => prefetchMerchantRoute\("BusinessProfileEditor"\)\}/,
  );
  assert.match(
    merchantDashboard,
    /onPressIn=\{\(\) => prefetchMerchantRoute\("VerificationCentre"\)\}/,
  );

  assert.match(merchantMenu, /const prefetchDishEditorRoute = useCallback/);
  assert.match(merchantMenu, /const prefetchPreviewMenuAsCustomer = useCallback/);
  assert.match(merchantMenu, /onPressIn=\{\(\) => preloadRoute\(navigation, "OCRDrafts"\)\}/);
  assert.match(merchantMenu, /onPressIn=\{\(\) => prefetchDishEditorRoute\(\)\}/);
  assert.match(merchantMenu, /onPressIn=\{\(\) => prefetchDishEditorRoute\(dish\)\}/);
  assert.match(merchantMenu, /onPressIn=\{prefetchPreviewMenuAsCustomer\}/);

  assert.match(favourites, /onPressIn=\{\(\) => \{[\s\S]*prefetchDishDetail\(dish\.id/);
  assert.match(favourites, /preloadRoute\(rootNavigation, "DishDetail", \{ dishId: dish\.id \}\)/);
  assert.match(
    socialPostDetail,
    /onPressIn=\{\(\) => \{[\s\S]*preloadRoute\(rootNavigation, "DishDetail"/,
  );

  assert.match(profileHome, /const prefetchMerchantDashboard = useCallback/);
  assert.match(profileHome, /function MenuRow[\s\S]*onPressIn\?: \(\) => void/);
  assert.match(profileHome, /function StatBlock[\s\S]*onPressIn\?: \(\) => void/);
  assert.match(profileHome, /onPressIn=\{prefetchMerchantDashboard\}/);
  assert.match(profileHome, /onPressIn=\{\(\) => preloadRoute\(navigation, "SocialGrid"/);
  assert.match(profileHome, /onPressIn=\{\(\) => preloadRoute\(navigation, "ReviewHistory"\)\}/);
  assert.match(profileHome, /onPressIn=\{\(\) => preloadRoute\(navigation, "Settings"\)\}/);

  assert.match(developerLauncher, /onV1PressIn\?: \(\) => void/);
  assert.match(developerLauncher, /const prefetchSampleStallDetail =/);
  assert.match(developerLauncher, /const prefetchSampleDishDetail =/);
  assert.match(developerLauncher, /onV1PressIn=\{\(\) => prefetchSampleStallDetail\("v1"\)\}/);
  assert.match(developerLauncher, /onV2PressIn=\{\(\) => prefetchSampleDishDetail\("v2"\)\}/);
  assert.match(developerLauncher, /onV1PressIn=\{\(\) => preloadRoute\(navigation, "MainTabs"/);
});
