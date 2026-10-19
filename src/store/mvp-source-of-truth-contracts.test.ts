import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("profile store treats Supabase writes as source of truth with guarded rollback", () => {
  const source = read("src/store/useProfileStore.ts");

  for (const method of [
    "profile.toggleFavourite",
    "profile.updateProfile",
    "profile.updateTasteVector",
    "profile.updateTasteProfile",
    "profile.updateDietaryPreferences",
  ]) {
    assert.match(source, new RegExp(method.replace(".", "\\.")));
  }

  assert.match(source, /previousSnapshot/);
  assert.match(source, /previousProfile/);
  assert.match(source, /const optimisticProfile = get\(\)\.profile/);
  assert.match(source, /if \(get\(\)\.profile !== optimisticProfile\) return/);
  assert.match(source, /function ensureSupabaseCompatibleProfile/);
  assert.match(source, /if \(getConfiguredDataSource\(\) !== "supabase"\)/);
  assert.match(source, /if \(isAuthenticated && userId && currentProfile\.id === userId\)/);
});

test("MVP profile identity uses Supabase storage and public profile sync", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const avatarMigration = read("supabase/migrations/0016_mobile_storage_security.sql");
  const publicProfileMigration = read(
    "supabase/migrations/20260522124728_security_advisor_rls_view_fixes.sql",
  );

  assert.match(service, /async function uploadAvatarIfNeeded/);
  assert.match(service, /bucket: "avatars"/);
  assert.match(service, /path: `\$\{userId\}\/avatar-\$\{Date\.now\(\)\}\.\$\{extension\}`/);
  assert.match(service, /payload\.avatar_url = await uploadAvatarIfNeeded/);
  assert.match(service, /from\("privacy_settings"\)\.upsert/);
  assert.match(avatarMigration, /\('avatars', 'avatars', true/);
  assert.match(avatarMigration, /avatars_insert_authenticated_own_prefix/);
  assert.match(publicProfileMigration, /create table if not exists public\.public_profiles/);
  assert.match(publicProfileMigration, /new\.avatar_url/);
  assert.match(publicProfileMigration, /trg_sync_public_profiles/);
});

test("MVP settings split keeps device-only preferences in local UI storage", () => {
  const uiStore = read("src/store/useUIStore.ts");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");

  for (const key of [
    "themePreference",
    "hapticFeedbackEnabled",
    "reducedMotionEnabled",
    "allowSearchHistory",
  ]) {
    assert.match(uiStore, new RegExp(`${key}: state\\.${key}`));
  }

  assert.match(settingsScreen, /useUIStore\(\(state\) => state\.hapticFeedbackEnabled\)/);
  assert.match(settingsScreen, /useUIStore\(\(state\) => state\.reducedMotionEnabled\)/);
  assert.match(settingsScreen, /setProfileVisibility\("private"\)/);
  assert.match(settingsScreen, /label="Reduce motion"/);
  assert.doesNotMatch(settingsScreen, /label="Analytics sharing"/);
});

test("every Settings switch backed by useUIStore has a consumer outside Settings", () => {
  const uiStore = read("src/store/useUIStore.ts");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");
  const consumers: Record<string, string> = {
    hapticFeedbackEnabled: "src/store/useSocialStore.ts",
    reducedMotionEnabled: "src/hooks/useReduceMotion.ts",
    allowSearchHistory: "src/store/useSearchStore.ts",
  };

  const settingsKeys = [
    ...settingsScreen.matchAll(
      /useUIStore\(\(state\) => state\.(?!set)([A-Za-z]+Enabled|allow[A-Za-z]+|show[A-Za-z]+)\)/g,
    ),
  ].map((match) => match[1]);
  for (const key of settingsKeys) {
    const consumer = consumers[key];
    assert.ok(consumer, `${key} is shown in Settings without a known consumer`);
    assert.match(read(consumer), new RegExp(key));
  }

  // Toggles that were saved but read by nothing must not come back as no-ops.
  for (const removed of [
    "showLocationBadge",
    "openToExternalApps",
    "dietaryFiltersEnabled",
    "activityFeedEnabled",
    "hideReviewedDishesFromFeed",
    "showOnlyFavoriteDishes",
    "pushNotificationsEnabled",
    "missionNotificationsEnabled",
    "showCredTier",
    "showPassportProgress",
    "showProfileBadges",
  ]) {
    assert.doesNotMatch(uiStore, new RegExp(removed));
    assert.doesNotMatch(settingsScreen, new RegExp(removed));
  }
});

test("Allow search history gates recording and clears history when turned off", () => {
  const searchStore = read("src/store/useSearchStore.ts");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");

  assert.match(searchStore, /useUIStore\.getState\(\)\.allowSearchHistory/);
  assert.match(
    searchStore,
    /rememberSearch:[\s\S]*?if \(!isSearchHistoryAllowed\(\)\) \{\s*return state;/,
  );
  assert.match(
    searchStore,
    /addHistoryEntry:[\s\S]*?if \(!isSearchHistoryAllowed\(\)\) \{\s*return state;/,
  );
  assert.match(
    searchStore,
    /clearSearchHistory: \(\) => set\(\{ recentSearches: \[\], history: \[\] \}\)/,
  );
  assert.match(settingsScreen, /onToggle=\{handleSearchHistoryToggle\}/);
  assert.match(
    settingsScreen,
    /handleSearchHistoryToggle = \(enabled: boolean\) => \{[\s\S]*?if \(!enabled\) \{\s*clearSearchHistory\(\);/,
  );
});

test("Change Password re-authenticates instead of exchanging a fake recovery code", () => {
  const editProfile = read("src/app/screens/profile/EditProfileScreen.tsx");
  const changePassword = read("src/app/screens/profile/ChangePasswordScreen.tsx");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.doesNotMatch(editProfile, /profile-settings/);
  assert.doesNotMatch(editProfile, /screen: "ResetPassword"/);
  assert.match(editProfile, /navigate\("ChangePassword"\)/);
  assert.match(editProfile, /auth\.canChangePassword\(\)/);
  assert.match(editProfile, /\{canChangePassword \? \(/);
  assert.match(changePassword, /auth\.changePassword\(currentPassword, newPassword\)/);
  assert.match(rootNavigator, /name="ChangePassword"/);

  const supabaseChange = supabase.slice(
    supabase.indexOf("async changePassword("),
    supabase.indexOf("async getCurrentSession("),
  );
  assert.match(supabaseChange, /signInWithPassword\(\{/);
  assert.match(supabaseChange, /updateUser\(\{ password: newPassword \}\)/);
  assert.doesNotMatch(supabaseChange, /exchange/i);
  assert.match(supabase, /identity\.provider === "email"/);
  assert.match(mock, /async canChangePassword\(\)/);
  assert.match(mock, /_authProvider = "google"/);
});

test("EAS release profiles set explicit MVP feature-flag environments", () => {
  const eas = JSON.parse(read("eas.json")) as {
    build: Record<string, { env?: Record<string, string> }>;
  };

  assert.equal(eas.build.development?.env?.EXPO_PUBLIC_APP_ENV, "development");
  assert.equal(eas.build.preview?.env?.EXPO_PUBLIC_APP_ENV, "staging");
  assert.equal(eas.build.production?.env?.EXPO_PUBLIC_APP_ENV, "production");
  assert.equal(eas.build.development?.env?.EXPO_PUBLIC_HUNGRY_DATA_SOURCE, "supabase");
  assert.equal(eas.build.preview?.env?.EXPO_PUBLIC_HUNGRY_DATA_SOURCE, "supabase");
  assert.equal(eas.build.production?.env?.EXPO_PUBLIC_HUNGRY_DATA_SOURCE, "supabase");
  // Staging QA must test the same catalog/search path that production ships.
  assert.equal(
    eas.build.preview?.env?.EXPO_PUBLIC_CATALOG_READ_V2,
    eas.build.production?.env?.EXPO_PUBLIC_CATALOG_READ_V2,
  );
});

test("production Post route publishes through the canonical composer service path", () => {
  const postScreen = read("src/app/screens/post/PostComposerScreen.tsx");
  const publishing = read("src/features/post/publishing.ts");
  const swipeTabs = read("src/app/navigation/SwipeableTabNavigator.tsx");

  // QA tests what ships: every environment opens the V1 Post composer.
  assert.match(swipeTabs, /rootNavigation\?\.navigate\("Post"\)/);
  assert.doesNotMatch(swipeTabs, /PostComposerV2/);
  assert.match(postScreen, /import \{ publishComposerPost \}/);
  assert.match(postScreen, /useComposerStore\.getState\(\)/);
  assert.match(postScreen, /confirmGalleryAccess/);
  assert.match(postScreen, /MediaTypeOptions: \{ All: string \}/);
  assert.match(postScreen, /launchImageLibraryAsync/);
  assert.match(postScreen, /composer\.reset\(\)/);
  assert.match(postScreen, /composer\.setCaption\(/);
  assert.match(postScreen, /composer\.addMedia\(selectedMedia\)/);
  assert.match(postScreen, /publishComposerPost\(\{\s*publishMode: "post"/);
  assert.match(postScreen, /disabled=\{selectedMedia\.length === 0\}/);
  assert.match(postScreen, /const \[selectedDishId, setSelectedDishId\]/);
  assert.match(postScreen, /const \[dishSearchQuery, setDishSearchQuery\]/);
  assert.match(postScreen, /repository\.getDishById\(selectedDishId\) \?\? null/);
  // A venue-only entry shows that stall's dishes; it never picks the first one.
  assert.doesNotMatch(postScreen, /listDishesByVenue\(selectedVenueId\)\[0\]/);
  assert.match(postScreen, /label="Find dish"/);
  assert.match(postScreen, /placeholder="Search dishes, stalls, or tags"/);
  assert.match(postScreen, /setSelectedDishId\(item\.id\)/);
  assert.match(postScreen, /setSelectedVenueId\(item\.venueId\)/);
  assert.match(postScreen, /message: "Choose a dish before publishing\."/);
  assert.doesNotMatch(postScreen, /title="No dish available"/);
  assert.doesNotMatch(postScreen, /Save draft for later/);
  assert.match(postScreen, /loading=\{isPublishing\}/);
  assert.match(publishing, /throw new Error\("Add a photo or video before publishing\."\)/);
  assert.match(publishing, /throw new Error\("Choose a dish before publishing\."\)/);
  assert.match(publishing, /const mediaUrls = media\.map\(\(item\) => item\.uri\)/);
  assert.doesNotMatch(postScreen, /fallbackDish/);
  assert.doesNotMatch(postScreen, /listPopularNearby\(\)\[0\]/);
  assert.doesNotMatch(publishing, /listPopularNearby\(\)\[0\]/);
  assert.doesNotMatch(publishing, /:\s*\[fallbackImageUrl\]/);
  assert.match(
    postScreen,
    /await publishComposerPost\([\s\S]*message: "Post published successfully\."/,
  );
});

test("signed-in onboarding merges guest taste and dietary choices into the Supabase profile", () => {
  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  const emailVerification = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  const login = read("src/app/screens/auth/LoginScreen.tsx");
  const signUp = read("src/app/screens/auth/SignUpScreen.tsx");
  const mergeHelper = read("src/features/auth/applySignedInProfile.ts");
  const profileStore = read("src/store/useProfileStore.ts");

  assert.match(onboardingAuth, /import \{ applySignedInProfile \}/);
  assert.match(onboardingAuth, /completedOnboarding: true/);
  assert.match(emailVerification, /import \{ applySignedInProfile \}/);
  assert.match(emailVerification, /applySignedInProfile\(session\.profile/);
  assert.match(emailVerification, /completedOnboarding: shouldCompleteOnboarding/);
  assert.match(emailVerification, /completeOnboarding\(\)/);
  assert.match(login, /import \{ applySignedInProfile \}/);
  assert.match(signUp, /import \{ applySignedInProfile \}/);
  assert.match(mergeHelper, /function hasMeaningfulGuestTaste/);
  assert.match(mergeHelper, /profile\.id !== "guest-user"[\s\S]*return false/);
  assert.match(mergeHelper, /recommendationSignals\?\.signalCount/);
  assert.match(mergeHelper, /function hasMeaningfulGuestDietaryPreferences/);
  assert.match(
    mergeHelper,
    /profile\.id === "guest-user" && profile\.dietaryPreferences\.length > 0/,
  );
  assert.match(mergeHelper, /tasteVector: shouldMergeTaste \? guestProfile\.tasteVector/);
  assert.match(mergeHelper, /tasteProfile: shouldMergeTaste \? guestTasteProfile/);
  assert.match(mergeHelper, /dietaryPreferences: shouldMergeDietary/);
  assert.match(mergeHelper, /shouldMergeTaste[\s\S]*updateTasteProfile\(guestTasteProfile\)/);
  assert.match(
    mergeHelper,
    /shouldMergeDietary[\s\S]*updateDietaryPreferences\(guestProfile\.dietaryPreferences\)/,
  );
  assert.match(profileStore, /function shouldSyncAuthenticatedProfile\(profile: UserProfile\)/);
  assert.match(profileStore, /session\.isAuthenticated/);
  assert.match(profileStore, /profile\.id === session\.authenticatedUserId/);
  assert.match(profileStore, /setTasteProfile: \(tasteProfile\) => \{/);
  assert.match(
    profileStore,
    /if \(!shouldSyncAuthenticatedProfile\(optimisticProfile\)\) \{\s*return;\s*\}/,
  );
  assert.match(profileStore, /\.profile\.updateTasteProfile\(tasteProfile\)/);
});

test("favourite hydration reads the user_favourite_dishes join table", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const profileStore = read("src/store/useProfileStore.ts");

  assert.match(service, /async function fetchFavouriteDishIdsForUser/);
  assert.match(service, /\.from\("user_favourite_dishes"\)[\s\S]*\.select\("dish_id"\)/);
  assert.match(
    service,
    /const favouriteDishIds = await fetchFavouriteDishIdsForUser\(client, userId\)/,
  );
  assert.match(service, /return fetchFavouriteDishIdsForUser\(client, userId\)/);
  assert.match(profileStore, /\.profile\.getFavouriteDishIds\(\)/);
  assert.match(profileStore, /favouriteDishIds: ids/);
  assert.match(profileStore, /favouritesCount: ids\.length/);
});

test("Supabase review reads hydrate review_photos and public profile names and avatars", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const domain = read("src/types/domain.ts");
  const detailTransforms = read("src/features/detail/detailTransforms.ts");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewHistory = read("src/app/screens/profile/ReviewHistoryScreen.tsx");

  assert.match(service, /async function mapSupabaseReviewRows/);
  assert.match(service, /from\("review_photos"\)/);
  assert.match(service, /from\("public_profiles"\)/);
  assert.match(service, /\.select\("id,display_name,avatar_url"\)/);
  assert.match(service, /\.from\("reviews"\)[\s\S]*\.eq\("dish_id", dishId\)/);
  assert.match(service, /\.from\("reviews"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(service, /dishId: asString\(row\.dish_id\)/);
  assert.match(
    service,
    /authorAvatarUrl: \(userId \? avatarsByUserId\.get\(userId\) : undefined\)/,
  );
  assert.match(service, /photos: photosByReviewId\.get\(id\) \?\? \[\]/);
  assert.match(domain, /authorAvatarUrl\?: string/);
  assert.match(
    detailTransforms,
    /avatarUrl: review\.authorAvatarUrl \?\? AVATAR_POOL\[avatarIndex\]/,
  );
  assert.doesNotMatch(
    service,
    /getReviewsForDish\(dishId\) \{\s*return supabaseRepository\.getDishById\(dishId\)\?\.reviews/,
  );
  assert.match(stallDetail, /serviceProviderMode === "mock" \? dish\.reviews : \[\]/);
  assert.match(reviewFeed, /getHungryService\(\)\.reviews\.listRecentReviews\(\{/);
  assert.doesNotMatch(reviewFeed, /reviews\.getReviewsForDish\(dish\.id\)/);
  assert.match(
    service,
    /async listRecentReviews\(options\)[\s\S]*\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.limit\(limit\)/,
  );
  assert.match(
    reviewFeed,
    /serviceProviderMode === "mock" \? listReviewFeedItems\(repository\) : \(serviceReviewItems \?\? \[\]\)/,
  );
  assert.match(reviewHistory, /serviceProviderMode === "supabase"\s*\?\s*remoteHistory/);
  assert.match(reviewHistory, /serviceProviderMode === "mock"/);
  assert.match(reviewHistory, /remoteLoadFailed/);
  assert.doesNotMatch(reviewHistory, /hasRemoteHistory \|\| localHistory/);
});

test("Supabase review feed does not send review ids through post reaction writes", () => {
  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");

  assert.match(reviewFeed, /const reviewReactionsEnabled = serviceProviderMode === "mock"/);
  assert.match(reviewFeed, /"Remove saved dish"/);
  assert.match(reviewFeed, /"Save dish"/);
  assert.doesNotMatch(reviewFeed, /"Unsave review"/);
  assert.doesNotMatch(reviewFeed, /"Save review"/);
  assert.match(reviewFeed, /\{reviewReactionsEnabled \? \(/);
  assert.match(reviewFeed, /toggleSave\(item\.interactionId\)/);
  assert.match(
    reviewFeed,
    /const localDish = item\.dish \?\? repository\.getDishById\(item\.dishId\)/,
  );
  assert.match(reviewFeed, /toggleFavourite\(localDish\)/);
  assert.match(reviewFeed, /saved: favouriteDishIds\.includes\(item\.dishId\)/);
  assert.doesNotMatch(reviewFeed, /void toggleSave\(item\.review\.id\);\s*const dish/);
});

test("advanced liked-content social collection is gated out of MVP production", () => {
  const profileStack = read("src/app/screens/profile/ProfileStack.tsx");
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(profileStack, /FEATURE_FLAGS\.collectionsEnabled \? \(/);
  assert.match(profileStack, /name="SocialGrid" getComponent=\{loadSocialGridScreen\}/);
  assert.match(profileStack, /name="SocialPostDetail" getComponent=\{loadSocialPostDetailScreen\}/);
  assert.doesNotMatch(profileStack, /SocialGridScreen\} from "\.\/SocialGridScreen"/);
  assert.match(profileHome, /isAuthenticated && FEATURE_FLAGS\.collectionsEnabled && \(/);
  assert.match(profileHome, /label="Liked Content"/);
});

test("Search results route hydrates through the service before trusting repository cache", () => {
  const searchFeature = read("src/features/search/search.ts");
  const searchScreen = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(searchFeature, /getHungryService\(\)\.discovery\.searchDishes/);
  assert.match(searchFeature, /export async function getSearchResultsAsync/);
  assert.match(searchScreen, /getSearchResultsAsync\(filters, profile\.tasteVector\)/);
  assert.match(
    searchScreen,
    /serviceResults \?\? getSearchResults\(filters, profile\.tasteVector\)/,
  );
});

test("Supabase app readiness keeps the legacy cache opt-in and bounded away from public routes", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");

  assert.match(bootstrap, /refreshSupabaseRepositoryCache/);
  assert.match(bootstrap, /EXPO_PUBLIC_HUNGRY_LEGACY_CACHE_WARMUP === "1"/);
  assert.match(bootstrap, /if \(shouldWarmLegacyRepositoryCache\(\)\)/);
  assert.match(bootstrap, /setIsDataSourceReady\(false\)/);
  assert.match(
    bootstrap,
    /setIsDataSourceReady\(true\);[\s\S]*if \(shouldWarmLegacyRepositoryCache\(\)\)/,
  );
  assert.doesNotMatch(bootstrap, /refreshSupabaseRepositoryCache\(\)[\s\S]{0,240}\.finally\(/);
  assert.match(repository, /let hydrationPromise: Promise<void> \| null = null/);
  assert.match(repository, /if \(hydrationPromise\) return hydrationPromise/);
  assert.doesNotMatch(
    repository,
    /\/\/ Kick off hydration on module load[\s\S]*ensureHydrated\(\);/,
  );
  assert.match(repository, /const venueById = new Map/);
});

test("Supabase social feed/profile history do not treat persisted local posts as canonical", () => {
  const sharedPosts = read("src/features/social/sharedStallPosts.ts");

  assert.match(sharedPosts, /getServiceProvider\(\)\.mode === "supabase"/);
  assert.match(
    sharedPosts,
    /return mergeStallPosts\(bitePosts, servicePosts, repository\.listStallPosts\(\)\)/,
  );
  assert.match(
    sharedPosts,
    /return mergeStallPosts\(usePublishedPostStore\.getState\(\)\.posts, repository\.listStallPosts\(\)\)/,
  );
});

test("MVP browse surfaces do not show obvious fake trust claims", () => {
  const feed = read("src/features/home/feed.ts");
  const searchScreen = read("src/app/screens/search/SearchResultsScreen.tsx");
  const supabaseRepository = read("src/lib/services/supabase/supabaseRepository.ts");

  assert.match(feed, /title: "Nearby picks"/);
  assert.doesNotMatch(feed, /Fastest Near You|Mock distance logic/);
  assert.match(searchScreen, /MessageCircle/);
  assert.doesNotMatch(searchScreen, /fallbackPost|Heart\b|likeCount/);
  assert.match(supabaseRepository, /isOpen: toBool\(row\.is_open, false\)/);
});

test("social store rolls back failed production reactions instead of persisting local-only truth", () => {
  const source = read("src/store/useSocialStore.ts");

  assert.match(source, /interactionStatesMatch/);
  // Idempotent: the store sends the state it wants, never a blind toggle.
  assert.match(source, /social\.reactToBite\(postId, "craving", isLiked\)/);
  assert.match(source, /social\.reactToBite\(postId, "save", isSaved\)/);
  // Writes for one post run in tap order.
  assert.match(source, /enqueueReactionWrite\(postId, "craving"/);
  // The liker never gets a "liked your post" update in their own inbox.
  assert.doesNotMatch(source, /addActivityUpdate/);
  // Feed reads carry the viewer's like/save, which overrides stale local state.
  assert.match(source, /item\.viewerHasLiked/);
  assert.doesNotMatch(source, /Post save ignored because this post is not backed by Supabase\./);
  assert.match(source, /rolled back optimistic state/);
  assert.match(source, /clearAccountScopedState/);
  assert.doesNotMatch(source, /kept optimistic state and will retry later/);
});

test("profile/public-profile post history can read posts through the social service contract", () => {
  const serviceTypes = read("src/lib/services/types.ts");
  const mockService = read("src/lib/services/mock/mockService.ts");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const profileContent = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(
    serviceTypes,
    /listUserPosts\(userId: string, page\?: \{ limit\?: number; offset\?: number \}\): Promise<Bite\[\]>/,
  );
  assert.match(mockService, /async listUserPosts\(userId: string, page\?/);
  assert.match(supabaseService, /async listUserPosts\(userId: string, page\?/);
  assert.match(profileContent, /listUserPosts\(normalizedAuthorId as string, \{/);
  // Author filtering happens on the server, not over the newest feed window.
  assert.match(
    supabaseService,
    /if \(options\?\.authorId\) query = query\.eq\("author_id", options\.authorId\)/,
  );
  assert.doesNotMatch(supabaseService, /bites\.filter\(\(bite\) => bite\.authorId === userId\)/);
  assert.match(profileContent, /mergeStallPosts\(/);
});
