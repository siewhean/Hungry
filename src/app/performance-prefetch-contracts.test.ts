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
  assert.match(tabs, /lazyPreloadDistance:\s*0/);
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
  assert.match(discover, /getDiscoverBites\(repository\)/);
  assert.match(
    discover,
    /getDiscoverBiteCollection\("quickBites", discoverBaseBites, repository\)/,
  );
  assert.match(quickBites, /useState\(false\)/);
});

test("prefetch layer warms images, data, and route modules without blocking navigation", () => {
  const prefetch = read("src/features/navigation/prefetch.ts");
  const homeScreen = read("src/app/screens/home/HomeFeedScreen.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const search = read("src/app/screens/search/SearchResultsScreen.tsx");
  const merchantTabs = read("src/app/navigation/MerchantTabs.tsx");
  const zoomableMedia = read("src/components/social/ZoomableMedia.tsx");
  const zoomableVideo = read("src/components/social/ZoomableVideo.tsx");

  assert.match(prefetch, /ExpoImage\.prefetch/);
  assert.match(prefetch, /export function prefetchDishDetail/);
  assert.match(prefetch, /export function prefetchStallDetail/);
  assert.match(prefetch, /export function prefetchPostDetail/);
  assert.match(prefetch, /export function preloadRoute/);
  assert.match(prefetch, /"preload" in navigation/);
  assert.match(prefetch, /export function prefetchMerchantTab/);
  assert.match(homeScreen, /onPressIn=\{\(\) => prefetchFeedCardRoute\(item\)\}/);
  assert.match(discover, /onPressIn=\{\(\) => prefetchBiteCard\(bite\)\}/);
  assert.match(search, /onPressIn=\{\(\) =>/);
  assert.match(merchantTabs, /prefetchMerchantTab\(route\.name/);
  assert.doesNotMatch(zoomableMedia, /from "expo-video"/);
  assert.match(zoomableMedia, /require\("\.\/ZoomableVideo"\)/);
  assert.match(zoomableVideo, /from "expo-video"/);
});
