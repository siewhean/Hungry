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
  assert.doesNotMatch(rootNavigator, /import \{ DeveloperLauncherScreen \}/);
  assert.match(rootNavigator, /getComponent=\{loadHomeMapScreen\}/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.merchantCentreEnabled \? \(/);
  assert.match(rootNavigator, /getComponent=\{loadMerchantTabs\}/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.prototypeRoutesEnabled \? \(/);
  assert.match(rootNavigator, /getComponent=\{loadPostComposerScreenV2\}/);
  assert.match(rootNavigator, /getComponent=\{loadDeveloperLauncherScreen\}/);
  assert.doesNotMatch(rootNavigator, /QuickReview/);
  assert.match(rootNavigator, /ReviewSuccessModalHost/);
  assert.doesNotMatch(rootNavigator, /import \* as CredEarnedToastModule/);
  assert.match(rootNavigator, /function CredEarnedToastHost/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.gamificationEnabled/);
  assert.match(rootNavigator, /require\("@\/components\/gamification\/CredEarnedToast"\)/);

  assert.doesNotMatch(tabs, /import \{ DiscoverHomeScreen \}/);
  assert.doesNotMatch(tabs, /import \{ ReviewFeedScreen \}/);
  assert.doesNotMatch(tabs, /import \{ ProfileStack \}/);
  assert.match(tabs, /lazy:\s*!tabPreloadEnabled/);
  assert.match(tabs, /lazyPlaceholder:\s*\(\)\s*=>\s*<TabScreenLoadingPlaceholder \/>/);
  assert.match(
    tabs,
    /scheduleIdleWork|InteractionManager\.runAfterInteractions|requestIdleCallback|setTimeout\(/,
  );
  assert.match(tabs, /function createDeferredTabScreen/);
  assert.match(tabs, /function scheduleMainTabScreensWarmup/);
  assert.match(tabs, /function TabScreenLoadingPlaceholder/);
  assert.match(tabs, /function warmMainTabRoute/);
  assert.match(tabs, /function scheduleMainTabRouteWarmup/);
  assert.match(tabs, /MAIN_TAB_INTENT_WARMUP_FALLBACK_DELAY_MS = 0/);
  assert.match(tabs, /scheduleMainTabRouteWarmup\(routeName\)/);
  assert.match(tabs, /onPressIn=\{onPressIn\}/);
  assert.doesNotMatch(tabs, /ActivityIndicator/);
  assert.doesNotMatch(tabs, /preloadRoute\(navigation, route\.name\)/);
  assert.match(tabs, /tabPreloadEnabled/);
  assert.match(tabs, /const MAIN_TAB_PRELOAD_DISTANCE = 3/);
  assert.match(tabs, /const MAIN_TAB_WARMUP_TIMEOUT_MS = 350/);
  assert.match(tabs, /fallbackDelayMs: MAIN_TAB_WARMUP_FALLBACK_DELAY_MS/);
  assert.match(tabs, /lazyPreloadDistance:\s*tabPreloadEnabled \? MAIN_TAB_PRELOAD_DISTANCE : 0/);
});

test("startup does not block indefinitely on fonts or analytics", () => {
  const appBody = read("src/app/AppBody.tsx");
  const bootstrap = read("src/hooks/useAppBootstrap.ts");

  assert.match(appBody, /APP_SHELL_FONT_GRACE_MS = 900/);
  assert.match(appBody, /fontGraceReached/);
  assert.doesNotMatch(appBody, /Font load delayed/);
  assert.match(bootstrap, /runAfterIdle|requestIdleCallback|setTimeout/);
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
  assert.match(homeFeed, /const HOME_FEED_BUNDLE_CACHE_TTL_MS = 5_000/);
  assert.match(homeFeed, /const homeFeedBundleCache = new Map/);
  assert.match(homeFeed, /export function getHomeFeedBundleCacheKey/);
  assert.match(homeFeed, /export function clearHomeFeedBundleCache/);
  assert.match(homeScreen, /getHomeFeedBundle\(profileRef\.current,\s*\{/);
  assert.match(homeScreen, /followedAuthors,/);
  assert.match(homeScreen, /followedUserIds,/);
  assert.match(homeScreen, /refreshSeed: feedRefreshSeedRef\.current/);
  assert.doesNotMatch(homeScreen, /getHomeFeed\(profile\)/);
  assert.doesNotMatch(homeScreen, /getHomeSocialFeed\(profile\)/);
  assert.doesNotMatch(homeScreen, /useEffect\(\(\) => \{\s*void loadFeed\(\);/);
  assert.match(homeScreen, /setTimeout/);
  assert.match(homeScreen, /FEED_LOAD_DEDUPE_MS = 1500/);
  assert.match(homeScreen, /lastLoadedFeedKeyRef/);
  assert.match(homeScreen, /lastLoadedFeedAtRef/);
  assert.match(homeScreen, /activeFeedLoadIdRef/);
  assert.doesNotMatch(homeScreen, /const publishedPosts = usePublishedPostStore/);
  assert.match(discover, /getDiscoverBites\(repository\)/);
  assert.match(discover, /getDiscoverBiteCollections\(discoverBaseBites, repository\)/);
  assert.match(discover, /const repositoryLookup = useMemo<DiscoverRepositoryLookup>/);
  assert.match(discover, /const dishById = new Map<string, DishDetail \| undefined>\(\)/);
  assert.match(discover, /const dishesByVenue = new Map<string, DishDetail\[\]>\(\)/);
  assert.match(discover, /const venuesByBuilding = new Map<string, VenueSummary\[\]>\(\)/);
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
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
  const merchantTabs = read("src/app/navigation/MerchantTabs.tsx");
  const zoomableMedia = read("src/components/social/ZoomableMedia.tsx");
  const zoomableVideo = read("src/components/social/ZoomableVideo.tsx");

  assert.match(prefetch, /ExpoImage\.prefetch/);
  assert.match(prefetch, /const prefetchedDishDetails = new Set<string>\(\)/);
  assert.match(prefetch, /const prefetchedStallDetails = new Set<string>\(\)/);
  assert.match(
    prefetch,
    /import \{ scheduleIdleWork \} from "@\/lib\/performance\/scheduleIdleWork"/,
  );
  assert.match(prefetch, /function schedulePrefetchWork/);
  assert.match(prefetch, /const PREFETCH_FALLBACK_DELAY_MS = 160/);
  assert.match(prefetch, /const MAX_IDLE_PREFETCH_WORK_PER_TICK = 8/);
  assert.match(prefetch, /pendingIdlePrefetchWorkCount/);
  assert.match(prefetch, /const scheduledRoutePreloads = new Set<string>\(\)/);
  assert.match(prefetch, /export function prefetchDishDetail/);
  assert.match(prefetch, /export function prefetchStallDetail/);
  assert.match(prefetch, /export function prefetchPostDetail/);
  assert.match(prefetch, /export function preloadRoute/);
  assert.match(prefetch, /export function prefetchBrowseResults/);
  // The catalog is server-paged: browse prefetch only preloads the results route.
  assert.doesNotMatch(prefetch, /getBrowseIndex|searchBrowseDishes/);
  assert.match(
    prefetch,
    /export function prefetchBrowseResults[\s\S]*preloadRoute\(navigation, "SearchResults"/,
  );
  assert.doesNotMatch(prefetch, /repository: DataRepository = getDataRepository\(\)/);
  assert.match(prefetch, /schedulePrefetchWork\(\(\) => \{[\s\S]*"preload" in navigation/);
  assert.match(prefetch, /"preload" in navigation/);
  assert.match(prefetch, /export function prefetchMerchantTab/);
  assert.match(homeScreen, /onPressIn=\{\(\) => prefetchFeedCardRoute\(item\)\}/);
  assert.match(discover, /onPressIn=\{\(\) => prefetchBiteCard\(bite\)\}/);
  assert.match(discover, /useDeferredValue\(activeDiscoverChipIds\)/);
  assert.match(discover, /renderLeftIcon=\{\(chip, isActive\) =>/);
  assert.match(discover, /prefetchBrowseResults\(item\.query, navigation/);
  assert.match(discover, /scheduleIdleWork\([\s\S]*preloadRoute\(navigation, "BrowseDishes"\)/);
  assert.match(discover, /<PopularFoodStyleItem/);
  assert.doesNotMatch(discover, /preloadRoute\(navigation, "SearchResults"/);
  assert.match(discover, /scheduleIdleWork\([\s\S]*recordTasteInteraction[\s\S]*popular_right_now/);
  assert.match(
    discover,
    /navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\);[\s\S]*scheduleIdleWork\([\s\S]*dish_result_click/,
  );
  assert.match(
    homeScreen,
    /navigation\.navigate\("DishDetail", \{ dishId: primaryDish\.id \}\);[\s\S]*scheduleIdleWork\([\s\S]*dish_result_click/,
  );
  assert.match(
    quickBites,
    /navigation\.navigate\("SearchResults", \{ initialQuery: query \|\| undefined \}\);[\s\S]*scheduleIdleWork\([\s\S]*rememberSearch\(query\)/,
  );
  assert.match(search, /function BrowseGridLoadingState/);
  assert.doesNotMatch(search, /getCachedBrowseIndex|getBrowseIndex/);
  assert.match(merchantTabs, /prefetchMerchantTab\(route\.name/);
  assert.doesNotMatch(zoomableMedia, /from "expo-video"/);
  assert.match(zoomableMedia, /require\("\.\/ZoomableVideo"\)/);
  assert.match(zoomableVideo, /from "expo-video"/);

  const scheduler = read("src/lib/performance/scheduleIdleWork.ts");
  assert.match(scheduler, /onComplete\?: \(\) => void/);
  assert.match(scheduler, /options\?\.onComplete\?\.\(\)/);
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
  assert.match(merchantDashboard, /onPressIn=\{\(\) => prefetchMerchantRoute\("Menu"\)\}/);
  assert.match(merchantDashboard, /onPressIn=\{\(\) => prefetchMerchantRoute\("CustomerInbox"\)\}/);
  assert.match(
    merchantDashboard,
    /onPressIn=\{\(\) => prefetchMerchantRoute\("FeaturedVisitors"\)\}/,
  );
  assert.match(
    merchantDashboard,
    /onPressIn=\{\(\) => prefetchMerchantRoute\("BusinessProfileEditor"\)\}/,
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
  assert.match(developerLauncher, /prefetchStallDetail\(sampleStallVenueId, repository\)/);
  assert.match(developerLauncher, /prefetchDishDetail\(dish\.id, repository\)/);
  assert.match(
    developerLauncher,
    /onV1PressIn=\{\(\) => preloadRoute\(navigation, "Post", getSampleComposerParams\(\)\)\}/,
  );
  assert.match(
    developerLauncher,
    /onV2PressIn=\{\(\) =>\s+preloadRoute\(navigation, "PostComposerV2"/,
  );
});

test("developer and merchant surfaces defer non-selected work", () => {
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const merchantTabs = read("src/app/navigation/MerchantTabs.tsx");
  const merchantStore = read("src/store/useMerchantStore.ts");
  const prefetch = read("src/features/navigation/prefetch.ts");

  assert.doesNotMatch(developerLauncher, /from "@\/lib\/geo\/singaporeBuildings"/);
  assert.doesNotMatch(developerLauncher, /from "@\/lib\/services\/mock\/data"/);
  assert.doesNotMatch(developerLauncher, /from "@\/features\/post\/useComposerStore"/);
  assert.match(developerLauncher, /function getLauncherRepository/);
  assert.doesNotMatch(developerLauncher, /function SGBuildingPickerContent/);
  assert.match(developerLauncher, /function DataInspectorContent/);
  assert.match(developerLauncher, /function PostComposerSettingsContent/);

  assert.doesNotMatch(merchantTabs, /from "@\/app\/screens\/merchant\/MerchantDashboardScreen"/);
  assert.doesNotMatch(merchantTabs, /from "@\/app\/screens\/merchant\/DishEditorScreen"/);
  assert.match(merchantTabs, /getComponent=\{loadMerchantDashboardScreen\}/);
  assert.match(merchantTabs, /getComponent=\{loadDishEditorScreen\}/);
  assert.match(merchantTabs, /MERCHANT_ACCOUNT_SYNC_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(merchantTabs, /hasFreshCachedAccount/);
  assert.match(merchantTabs, /scheduleIdleWork/);

  assert.match(merchantStore, /accountSyncedAt: number \| null/);
  assert.match(merchantStore, /activeOutletStillExists/);
  assert.match(merchantStore, /activeOutletStillExists[\s\S]*state\.activeOutletId/);

  // R2: merchant tab prefetching threw its results away, so it no longer fires requests.
  assert.doesNotMatch(prefetch, /merchant\.get(Analytics|Promotions|Inbox|TeamMembers)/);
  assert.doesNotMatch(prefetch, /getHungryService/);
});
