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
    "profile.setFavourite",
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
  assert.match(service, /: await uploadAvatarIfNeeded\(client, userId, updates\.avatarUrl\)/);
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

  assert.match(uiStore, /leftHandedMode: state\.leftHandedMode/);
  assert.match(settingsScreen, /hapticFeedbackEnabled: state\.hapticFeedbackEnabled/);
  assert.match(settingsScreen, /reducedMotionEnabled: state\.reducedMotionEnabled/);
  assert.match(settingsScreen, /leftHandedMode: state\.leftHandedMode/);
  assert.match(settingsScreen, /value: "private" as const/);
  assert.match(settingsScreen, /label="Reduce motion"/);
  assert.doesNotMatch(settingsScreen, /label="Analytics sharing"/);
});

test("every Settings switch backed by useUIStore has a consumer outside Settings", () => {
  const uiStore = read("src/store/useUIStore.ts");
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");
  const consumers: Record<string, string> = {
    // Every haptic goes through the wrapper (expo-haptics is lint-banned elsewhere).
    hapticFeedbackEnabled: "src/lib/haptics.ts",
    leftHandedMode: "src/components/ui/FAB.tsx",
    reducedMotionEnabled: "src/hooks/useReduceMotion.ts",
    allowSearchHistory: "src/store/useSearchStore.ts",
  };

  const settingsKeys = [
    ...settingsScreen.matchAll(
      /\b(?!set)([A-Za-z]+Enabled|allow[A-Za-z]+|leftHandedMode): state\.\1\b/g,
    ),
  ].map((match) => match[1]);
  assert.ok(settingsKeys.length >= 4, "Settings switches were not found");
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
    /rememberSearch:[\s\S]*?!isSearchHistoryAllowed\(\)\) \{\s*return state;/,
  );
  // The unused filters and history are gone from the store; only recent searches are kept.
  assert.doesNotMatch(
    searchStore,
    /addHistoryEntry|removeHistoryEntry|clearHistory|toggleCategory/,
  );
  assert.match(searchStore, /clearSearchHistory: \(\) => set\(\{ recentSearches: \[\] \}\)/);
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
  // The Change password row moved to Settings > Sign-in and security.
  const settingsScreen = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.match(settingsScreen, /navigate\("ChangePassword"\)/);
  assert.match(settingsScreen, /auth\.canChangePassword\(\)/);
  assert.match(settingsScreen, /\{canChangePassword && isAuthenticated \? \(/);
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
  // Every profile runs the one paged catalog path; there is no flag to diverge on.
  for (const profile of ["development", "preview", "production"]) {
    assert.equal(eas.build[profile]?.env?.EXPO_PUBLIC_CATALOG_READ_V2, undefined);
  }
});

test("post composer remains isolated behind the Release 0.1 post flag", () => {
  const postScreen = read("src/app/screens/post/PostComposerScreen.tsx");
  const publishing = read("src/features/post/publishing.ts");
  const swipeTabs = read("src/app/navigation/SwipeableTabNavigator.tsx");

  // The tab bar's middle button writes a review; it never opens a composer.
  assert.match(swipeTabs, /FEATURE_FLAGS\.reviewCreationEnabled[\s\S]*key: "Create"/);
  assert.doesNotMatch(swipeTabs, /navigate\("Post"\)|PostComposerV2/);
  assert.match(postScreen, /import \{ publishComposerPost \}/);
  assert.match(postScreen, /useComposerStore\.getState\(\)/);
  // Camera or library, asked for only when chosen.
  assert.match(postScreen, /askMediaSource\("Add media"\)/);
  assert.match(postScreen, /import \* as ImagePicker from "expo-image-picker"/);
  assert.match(postScreen, /mediaTypes: \["images", "videos"\]/);
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

test("signed-in onboarding persists and awaits provisional preference migration", () => {
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
  assert.match(emailVerification, /completeVerifiedSignUp\(shouldCompleteOnboarding\)/);
  assert.match(login, /import \{ applySignedInProfile \}/);
  assert.match(signUp, /import \{ applySignedInProfile \}/);
  for (const caller of [onboardingAuth, emailVerification, login, signUp]) {
    assert.match(caller, /migration\.status === "failed"/);
  }
  assert.match(
    mergeHelper,
    /export type ProfileMigrationStatus = "synced" \| "partial_retry_queued" \| "failed"/,
  );
  assert.match(mergeHelper, /function createProvisionalMigration/);
  assert.match(mergeHelper, /function isProvisionalOnboardingProfile/);
  assert.match(mergeHelper, /recommendationSignals\?\.signalCount/);
  assert.match(mergeHelper, /await operations\.awaitProfile\(\)/);
  assert.match(mergeHelper, /Promise\.allSettled/);
  assert.match(mergeHelper, /mergeServerProfileWithProvisional/);
  assert.match(mergeHelper, /clearProvisionalOnboardingMigration/);
  assert.match(mergeHelper, /setProvisionalOnboardingMigration/);
  assert.match(profileStore, /function shouldSyncAuthenticatedProfile\(profile: UserProfile\)/);
  assert.match(profileStore, /session\.isAuthenticated/);
  assert.match(profileStore, /profile\.id === session\.authenticatedUserId/);
  assert.match(profileStore, /setTasteProfile: \(tasteProfile\) => \{/);
  assert.match(profileStore, /provisionalOnboardingMigration/);
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
  // Reviewers without a photo get the Avatar fallback, never a stock face.
  assert.match(detailTransforms, /avatarUrl: review\.authorAvatarUrl,/);
  assert.doesNotMatch(detailTransforms, /AVATAR_POOL|unsplash|Verified Foodie/);
  assert.doesNotMatch(
    service,
    /getReviewsForDish\(dishId\) \{\s*return supabaseRepository\.getDishById\(dishId\)\?\.reviews/,
  );
  // The stall reads its newest reviews in one query scoped to its menu, not one per dish.
  assert.match(stallDetail, /reviews\.listRecentReviewsPage\(\{\s*venueId: sideLoadVenueId,/);
  assert.doesNotMatch(stallDetail, /getReviewsForDish/);
  assert.match(stallDetail, /<Avatar uri=\{review\.avatarUrl\}/);
  assert.match(reviewFeed, /getHungryService\(\)\.reviews\.listRecentReviewsPage\(\{/);
  assert.doesNotMatch(reviewFeed, /reviews\.getReviewsForDish\(dish\.id\)/);
  assert.match(
    service,
    /async function fetchRecentReviewsPage[\s\S]*\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.limit\(limit\)/,
  );
  // Owner replies must come back with the rows or detail screens drop them in Supabase mode.
  assert.match(
    service,
    /const REVIEW_FEED_COLUMNS =\s*"[^"]*merchant_reply_text,merchant_replied_at,helpful_count[^"]*"/,
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

  // Round 6: the Reviews grid has no like, save or share buttons, so it writes no reactions.
  assert.doesNotMatch(reviewFeed, /useSocialStore|toggleSave|toggleLike|incrementShare/);
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
  assert.match(profileHome, /label="Liked content"/);
});

test("Search results route reads the paged catalog service, never the repository cache", () => {
  const searchScreen = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(searchScreen, /const service = getCatalogRawService\(\)/);
  assert.doesNotMatch(searchScreen, /getDataRepository|getSearchResults|getHungryService/);
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
    /mergeStallPosts\(bitePosts, servicePosts, repository\.listStallPosts\(\)\)/,
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

  // The Home feed no longer builds taste or "nearby" sections it never showed.
  assert.doesNotMatch(feed, /Nearby picks/);
  assert.doesNotMatch(feed, /Fastest Near You|Mock distance logic/);
  assert.doesNotMatch(searchScreen, /fallbackPost|Heart\b|likeCount/);
  // Only positive verification is badged, with one label; unverified rows carry no pill.
  assert.match(searchScreen, /item\.verificationStatus === "approved"/);
  assert.doesNotMatch(searchScreen, /Source verified/);
  assert.doesNotMatch(searchScreen, /"Unverified"/);
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
