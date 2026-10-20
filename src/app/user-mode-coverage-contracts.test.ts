import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRepoFileExists,
  assertSourceExcludes,
  assertSourceIncludes,
  readRepoFile,
  segmentBetween,
} from "@/test/sourceContracts";

test("user auth and onboarding flows cover account, taste, dietary, and location state", () => {
  const authStack = readRepoFile("src/app/screens/auth/AuthStack.tsx");
  const onboardingStack = readRepoFile("src/app/screens/onboarding/OnboardingStack.tsx");
  const login = readRepoFile("src/app/screens/auth/LoginScreen.tsx");
  const signUp = readRepoFile("src/app/screens/auth/SignUpScreen.tsx");
  const settings = readRepoFile("src/app/screens/profile/SettingsScreen.tsx");
  const tasteQuiz = readRepoFile("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const locationPermission = readRepoFile(
    "src/app/screens/onboarding/LocationPermissionScreen.tsx",
  );
  const manualLocation = readRepoFile("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  const types = readRepoFile("src/app/navigation/navigationTypes.ts");

  assertSourceIncludes(
    types,
    [
      /Login: undefined/,
      /SignUp: undefined/,
      /EmailVerification:\s*\|\s*\{\s*email\?: string;\s*completedOnboarding\?: boolean;\s*code\?: string;/,
      /ForgotPassword: undefined/,
      /ResetPassword: \{ email\?: string; code\?: string; error\?: "expired" \| "invalid" \} \| undefined/,
      /TasteQuiz: \{ mode\?: "onboarding" \| "profile"; initialPhase\?: "taste" \| "dietary" \} \| undefined/,
      /LocationPermission: undefined/,
      /ManualLocationPicker: \{ mode\?: "settings" \} \| undefined/,
    ],
    "navigation auth/onboarding types",
  );
  assertSourceIncludes(
    authStack,
    [
      /<Stack\.Screen name="Login" component=\{LoginScreen\}/,
      /<Stack\.Screen name="SignUp" component=\{SignUpScreen\}/,
      /<Stack\.Screen name="EmailVerification" component=\{EmailVerificationScreen\}/,
      /<Stack\.Screen name="ForgotPassword" component=\{ForgotPasswordScreen\}/,
      /<Stack\.Screen name="ResetPassword" component=\{ResetPasswordScreen\}/,
    ],
    "AuthStack",
  );
  assertSourceIncludes(
    onboardingStack,
    [
      /<Stack\.Screen name="TasteQuiz" component=\{TasteQuizScreen\}/,
      /<Stack\.Screen name="DietaryPreferences" component=\{TasteQuizScreen\}/,
      /<Stack\.Screen name="LocationPermission" component=\{LocationPermissionScreen\}/,
      /<Stack\.Screen name="ManualLocationPicker" component=\{ManualLocationPickerScreen\}/,
    ],
    "OnboardingStack",
  );
  assertSourceIncludes(
    login,
    [
      /getHungryService\(\)\.auth\.signIn\(/,
      /service\.auth\.signInWithGoogle\(/,
      /service\.auth\.signInWithApple\(/,
      // Email sign-in is an existing account; the quiz state is not overwritten.
      /completeAuth\(\{ completedOnboarding: true \}\)/,
    ],
    "LoginScreen",
  );
  assertSourceIncludes(
    signUp,
    [
      /getHungryService\(\)\.auth\.signUp\(/,
      /navigation\.navigate\("EmailVerification"/,
      /completeAuth\(\{[\s\S]*completedOnboarding: hasCompletedOnboarding/,
      /navigation\.navigate\("EmailVerification", \{[\s\S]*completedOnboarding: hasCompletedOnboarding/,
    ],
    "SignUpScreen",
  );
  // RootNavigator alone routes a signed-in user into onboarding.
  assert.doesNotMatch(signUp, /navigation\.getParent\(\)\?\.reset\(\{[\s\S]*OnboardingStack/);
  assertSourceIncludes(
    settings,
    [
      /const handleDeleteAccount = \(\) =>/,
      /purgePersistedAccountData\(\)/,
      // signOut() clears session, profile and every account-scoped store and
      // signs out of Supabase; Login then shows the deletion confirmation.
      /setAuthNotice\(/,
      /signOut\(\);\s*resetToLogin\(\);/,
    ],
    "SettingsScreen delete account",
  );
  assertSourceIncludes(
    tasteQuiz,
    [
      /const setTasteVector = useProfileStore/,
      /const setDietaryPreferences = useProfileStore/,
      /setTasteVector\(values\)/,
      /setDietaryPreferences\(dietaryPreferences\)/,
      /setSkippedTasteQuiz\(true\)/,
      /navigation\.navigate\("TasteProfileResult"\)/,
    ],
    "TasteQuizScreen",
  );
  assertSourceIncludes(
    locationPermission,
    [/grantLocation\(\)/, /navigation\.navigate\("TasteQuiz"\)/, /ManualLocationPicker/],
    "LocationPermissionScreen",
  );
  assertSourceIncludes(
    manualLocation,
    [/setManualSelection/, /navigation\.navigate\("TasteQuiz"\)/],
    "ManualLocationPickerScreen",
  );
  assertSourceIncludes(
    readRepoFile("src/app/screens/onboarding/MandatoryOnboardingAuthScreen.tsx"),
    [/completeOnboarding\(hasSkippedTasteQuiz\)/, /<OnboardingAuthScreen/],
    "MandatoryOnboardingAuthScreen",
  );
});

test("home feed post cards cover carousel media, captions, comments, reactions, and refresh", () => {
  const home = readRepoFile("src/app/screens/home/HomeFeedScreen.tsx");
  const feed = readRepoFile("src/features/home/feed.ts");
  const socialStore = readRepoFile("src/store/useSocialStore.ts");
  const publishing = readRepoFile("src/features/post/publishing.ts");

  assertSourceIncludes(
    feed,
    [/listSharedStallPosts\(repository\)/, /runRecommendationPipeline/, /getHomeFeedBundle/],
    "home feed bundle",
  );
  assertSourceIncludes(
    home,
    [
      /RefreshControl/,
      /preserveReadyOnError: true, showLoading: false/,
      /const mediaUrls =\s*item\.mediaType === "photo" && item\.mediaUrls\?\.length/,
      /horizontal[\s\S]*pagingEnabled[\s\S]*showsHorizontalScrollIndicator=\{false\}/,
      /numberOfLines=\{isCaptionExpanded \? undefined : 2\}/,
      /\{" more"\}/,
      /activeCommentItem\.caption/,
      /const openCommentSheet = useCallback/,
      /const commentSheet = commentsSheetRef\.current/,
      /openCommentSheet\(\)/,
      /commentsByPostId\[activeCommentItem\.id\] \?\? \[\]/,
      /addPostComment\(activeCommentItem\.id, newComment\)/,
      /addPostReply\(activeCommentItem\.id, newReply\)/,
      /togglePostLike/,
      /togglePostSave/,
      /incrementPostShare/,
      /FloatingShareSendButton/,
      /setCarouselIndexByPostId/,
      /const postAgeLabel = formatPostAge\(item\.createdAt\)/,
    ],
    "HomeFeedScreen interactions",
  );
  assertSourceExcludes(
    home,
    [/localCommentsByPostId/, /localRepliesByCommentId/, /interaction\.saveCount > 0/],
    "HomeFeedScreen local-only regressions",
  );
  assertSourceIncludes(
    socialStore,
    [
      /persist\(/,
      /commentsByPostId/,
      /repliesByCommentId/,
      /addComment: \(postId, comment\) =>/,
      /addReply: \(postId, reply\) =>/,
      /commentCount: current\.commentCount \+ 1/,
    ],
    "social store comment persistence",
  );
  assertSourceIncludes(
    publishing,
    [
      /mediaUrls: media\.mediaUrls/,
      /caption,/,
      /tags: \[\.\.\.state\.foodTags, \.\.\.state\.tasteTags\]/,
      /usePublishedPostStore\.getState\(\)\.upsertPost\(post\)/,
    ],
    "published post persistence",
  );
});

test("discover routes diners to details, opens the map from a toggle, and search grids open catalog records", () => {
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const quickBites = readRepoFile("src/app/screens/discover/QuickBitesScreen.tsx");
  const searchResults = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");

  assertSourceIncludes(
    discover,
    [
      /const isUserMode = !isDeveloperMode && !isMerchantMode/,
      /<DiscoverViewToggle\s+value="list"/,
      /navigation\.navigate\("StallDetail", \{ venueId: venue\.id \}\)/,
      /navigation\.navigate\("MapZoomedIn", \{[\s\S]*buildingId: venue\.buildingId/,
      /navigation\.navigate\("BrowseStalls"\)/,
      /navigation\.navigate\("BrowseDishes"\)/,
      /navigation\.navigate\("DecideForMeResult", \{ surface: "discover" \}/,
      /navigation\.navigate\("WheelStack", \{ screen: "WheelHome" \}\)/,
      /recordTasteInteraction\(\{[\s\S]*type: "search_query"/,
      /recordTasteInteraction\(\{[\s\S]*type: "dish_result_click"/,
    ],
    "DiscoverHomeScreen user mode routing",
  );
  assertSourceIncludes(
    quickBites,
    [
      /ExpandableSearchLauncher/,
      /accessibilityLabel="Search dishes"/,
      /iconAlignment="right"/,
      /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dishId \}\)/,
      /accessibilityLabel=\{`Open \$\{activeSlide\.dishName\} at \$\{activeSlide\.venueName\}`\}/,
      /\{activeSlide\.dishName\}/,
    ],
    "QuickBitesScreen search icon and card mapping",
  );
  assertSourceIncludes(
    searchResults,
    [
      /navigation\.navigate\("CatalogRawDetail", \{\s*kind: mode === "dishes" \? "dish" : "venue",/,
      /accessibilityLabel=\{`\$\{title\} image`\}/,
      /type: "search_query"/,
      /type: "dish_result_click"/,
    ],
    "SearchResultsScreen catalog card to detail consistency",
  );
  // Taste signal fires on a submitted query, not on every debounced page load.
  const loadPageBody =
    searchResults.match(/const loadPage = useCallback\([\s\S]*?\n  \);/)?.[0] ?? "";
  assert.ok(loadPageBody, "loadPage should exist");
  assert.doesNotMatch(loadPageBody, /search_query/);
  assert.match(searchResults, /onSubmitEditing=\{\(\) => recordCommittedQuery\(searchQuery\)\}/);
  assert.match(searchResults, /recordCommittedQuery\(initialSearchQuery\)/);
  assertSourceIncludes(
    rootNavigator,
    [/name="BrowseDishes"/, /name="BrowseStalls"/, /name="DecideForMeResult"/, /name="WheelStack"/],
    "root navigator discover routes",
  );
});

test("dish and stall details expose correct detail surfaces without user-mode map/cart regressions", () => {
  const dishDetail = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallDetail = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const userModeStallPress = segmentBetween(
    discover,
    "if (isUserMode) {",
    'navigation.navigate("MapZoomedIn"',
  );

  assertSourceIncludes(
    dishDetail,
    [
      /const gallery = useMemo\([\s\S]*?dish\s*\? buildDishGallery\(dish\)[\s\S]*?sanitizeCatalogImageUrl/,
      /dish\.tasteVector\[dimension\.key\]/,
      /ReviewShareSheet/,
      /toggleFavourite\(dish\)/,
    ],
    "DishDetailScreen",
  );
  assertSourceIncludes(
    stallDetail,
    [
      /height: screenWidth \* 0\.75/,
      /const stallAddress =/,
      /import \{ StallLogoMark \} from "@\/components\/stall\/StallLogoMark"/,
      /logoUrl=\{sanitizeCatalogImageUrl\(venue\.logoUrl\)\}/,
      /<AppText variant="h2">Address<\/AppText>/,
      /\{stallAddress\}/,
      /Loading stall/,
      /<AppText variant="h2">Menu<\/AppText>/,
      /const \[visibleMenuItemCount, setVisibleMenuItemCount\] = useState\(INITIAL_MENU_ITEM_COUNT\)/,
      /onScroll=\{handleScroll\}/,
      /onLayout=\{handleContentBodyLayout\}/,
      /onLayout=\{handleMenuSectionLayout\}/,
      /contentBodyLayout\.y \+ menuSectionLayout\.y \+ menuSectionLayout\.height/,
      /filteredMenuDishes\.slice\(0, visibleMenuItemCount\)/,
      /setVisibleMenuItemCount\(\(current\) =>[\s\S]*MENU_ITEM_BATCH_SIZE[\s\S]*filteredMenuDishes\.length/,
      /menuCategories\.map\(\(category\) =>/,
      /navigation\.navigate\("DishDetail", \{ dishId: activeDish\.id \}\)/,
      /StallInteractionBar/,
      /ReviewShareSheet/,
    ],
    "StallDetailScreen required content",
  );
  assertSourceExcludes(
    stallDetail,
    [
      /StickyBottomBar/,
      /Add to cart/,
      /Order delivery/,
      /navigation\.navigate\("MapZoomedIn", \{ buildingId: venue\.buildingId \}\)/,
      /<LinearGradient/,
      /heroGradientColors/,
      /<Star color=\{palette\.surface\} fill=\{palette\.surface\}/,
      /\(leadDish\?\.rating \?\? 4\.8\)\.toFixed\(1\)/,
      /Loading stall details/,
      /See all/,
      /dishes\.map\(\(dish, index\) =>/,
    ],
    "StallDetailScreen removed map/cart/rating/fade regressions",
  );
  assert.match(
    userModeStallPress,
    /navigation\.navigate\("StallDetail", \{ venueId: card\.venue\.id \}\)/,
  );
});

test("review tab covers loading state, review cards, and bite card icon/sheet boundaries", () => {
  const reviewFeed = readRepoFile("src/app/screens/review/ReviewFeedScreen.tsx");
  const bitesContract = readRepoFile("src/app/screens/review-feed-bites-contracts.test.ts");

  assertSourceIncludes(
    reviewFeed,
    [
      // The skeleton follows the real fetch, not a setTimeout(0) flag.
      /useDelayedLoadingSkeleton\(isServiceFeedLoading, 0\)/,
      /ReviewFeedSkeleton/,
      /ReviewCommentsSheet/,
      /ReviewShareSheet/,
      /commentsEnabled=\{commentsEnabled\}/,
      /const openCommentsSheet = useCallback/,
      /const commentSheet = commentsSheetRef\.current/,
      /openCommentsSheet\(\)/,
      /accessibilityLabel="Open review comments"/,
      /const reviewReactionsEnabled = serviceProviderMode === "mock"/,
      /accessibilityLabel=\{interaction\.liked \? "Unlike review" : "Like review"\}/,
      /"Remove saved dish"/,
      /"Save dish"/,
      /saved: favouriteDishIds\.includes\(item\.dishId\)/,
      /<Send[\s\S]*<Bookmark[\s\S]*<CommentIcon[\s\S]*<Heart/,
      /justifyContent: "flex-end"/,
    ],
    "review feed card actions",
  );
  assertSourceExcludes(
    reviewFeed,
    [/BiteCommentsSheet/, /activeCommentBite/, /getHomeBitesFeed\(\)/],
    "review feed bite sheet regressions",
  );

  assertSourceIncludes(
    bitesContract,
    [/Review feed cards do not render bottom bites sections/, /BiteCommentsSheet/],
    "review bite regression contract",
  );
});

test("post composer supports long captions, tags, carousel media, publish, draft, and media validation", () => {
  const composer = readRepoFile("src/app/screens/post/PostComposerScreenV2.tsx");
  const bottomBar = readRepoFile("src/features/post/components/ComposerBottomBar.tsx");
  const mediaManager = readRepoFile("src/features/post/components/MediaManager.tsx");
  const postTab = readRepoFile("src/features/post/components/PostTab.tsx");
  const sharedMetadata = readRepoFile("src/features/post/components/SharedMetadata.tsx");
  const statusOverlay = readRepoFile("src/features/post/components/StatusOverlay.tsx");
  const publishing = readRepoFile("src/features/post/publishing.ts");
  const store = readRepoFile("src/features/post/useComposerStore.ts");

  assertSourceIncludes(
    composer,
    [
      /testID="post-composer-screen"/,
      /title="Save Draft\?"/,
      /setPublishingState\("draft"\)/,
      /navigation\.dispatch\(\{[\s\S]*type: "POP_TO"[\s\S]*name: "MainTabs"/,
    ],
    "PostComposerScreenV2 shell",
  );
  assertSourceIncludes(
    bottomBar,
    [
      /label="Save Draft"/,
      /setPublishingState\("draft"\)/,
      /label=\{getLabel\(\)\}/,
      /const request = \{ publishMode, routeDishId, routeVenueId \}/,
      /setLastPublishRequest\(request\)/,
      /await publishComposerPost\(request\)/,
      /setPublishingState\("posting"\)/,
      /setPublishingState\("success"\)/,
      /setPublishingState\("error"\)/,
    ],
    "ComposerBottomBar publish states",
  );
  assertSourceIncludes(
    mediaManager,
    [
      /requestMediaLibraryPermissionsAsync/,
      /launchImageLibraryAsync/,
      /allowsMultipleSelection: true/,
      /mediaTypes: ImagePicker\.MediaTypeOptions\.All/,
      /testID="post-composer-add-media"/,
    ],
    "MediaManager validation and carousel media entry",
  );
  // Photo filters/adjustments were preview-only (the original file uploads), so they are gone.
  assert.doesNotMatch(mediaManager, /setEditingMediaId|Edit with AI|video edit tools/);
  assert.doesNotMatch(composer, /MediaEditor/);
  assert.doesNotMatch(store, /adjustments|filterId|editingMediaId|updateMediaAdjustment/);
  assertSourceIncludes(
    postTab,
    [
      /const ctaButton = useComposerStore\(\(state\) => state\.ctaButton\)/,
      /const setCTA = useComposerStore\(\(state\) => state\.setCTA\)/,
      /text: "Order Now"[\s\S]*setCTA\("Order Now"\)/,
      /text: "View Menu"[\s\S]*setCTA\("View Menu"\)/,
      /text: "Book Table"[\s\S]*setCTA\("Book Table"\)/,
      /text: "Remove CTA"[\s\S]*setCTA\(null\)/,
    ],
    "PostTab CTA selector",
  );
  assertSourceIncludes(
    sharedMetadata,
    [/toggleTag\(tag, "food"\)/, /toggleTag\(tag, "taste"\)/, /tasteTags\.includes\(tag\)/],
    "SharedMetadata tags",
  );
  assertSourceIncludes(
    statusOverlay,
    [
      /import \{ publishComposerPost \} from "\.\.\/publishing"/,
      /const retryPublish = async \(\) =>/,
      /await publishComposerPost\(lastPublishRequest\)/,
      /label="Try Again"[\s\S]*void retryPublish\(\)/,
      /isReviewOnlySuccess \? "Review saved" : "Shared!"/,
      /label=\{isReviewOnlySuccess \? "Done" : "View Post"\}/,
    ],
    "StatusOverlay retry",
  );
  assertSourceIncludes(
    publishing,
    [
      /throw new Error\("Add a photo or video before publishing\."\)/,
      /throw new Error\("Add a rating before publishing a review\."\)/,
      /await service\.reviews\.submitReview\(/,
      /const mediaUrls = media\.map\(\(item\) => item\.uri\)/,
      /caption = state\.postCaption\.trim\(\) \|\| state\.reviewCaption\.trim\(\) \|\| dish\.name/,
      /mediaUrls,/,
      /tags: \[\.\.\.state\.foodTags, \.\.\.state\.tasteTags\]/,
      /usePublishedPostStore\.getState\(\)\.upsertPost\(post\)/,
    ],
    "publishComposerPost data contract",
  );
  assertSourceIncludes(
    store,
    [
      /postCaption: ""/,
      /reviewCaption: ""/,
      /media: \[\]/,
      /foodTags: \[\]/,
      /tasteTags: \[\]/,
      /lastPublishRequest: null/,
      /setLastPublishRequest:/,
    ],
    "composer store initial state",
  );
});

test("profile surfaces keep own and other-user layouts linked while hiding taste fingerprint for others", () => {
  const profileHome = readRepoFile("src/app/screens/profile/ProfileHomeScreen.tsx");
  const userProfile = readRepoFile("src/app/screens/profile/UserProfileContent.tsx");
  const connections = readRepoFile("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  const settings = readRepoFile("src/app/screens/profile/SettingsScreen.tsx");
  const profileStore = readRepoFile("src/store/useProfileStore.ts");
  const supabaseService = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const domain = readRepoFile("src/types/domain.ts");

  assertSourceIncludes(
    profileHome,
    [
      /profile\.avatarUrl \? \([\s\S]*<AccessibleImage[\s\S]*source=\{\{ uri: profile\.avatarUrl \}\}/,
      /avatarInitials/,
      /<UserProfileContent[\s\S]*authorName=\{viewerAuthorName\}[\s\S]*authorAvatarUrl=\{viewerAuthorAvatarUrl\}/,
      /<AppText variant="h2">Taste Fingerprint<\/AppText>/,
      /label="Followers"/,
      /label="Following"/,
      /label="Reviews"/,
      /label="Stalls"/,
      /label="Saved"/,
      /accessibilityLabel=\{menuOpen \? "Close quick access" : "Open quick access"\}/,
      /accessibilityLabel="Edit profile"/,
      /accessibilityLabel="Share Taste Fingerprint"/,
      /<AppText\s+variant="h1"\s+numberOfLines=\{1\}\s+adjustsFontSizeToFit\s+minimumFontScale=\{0\.78\}[\s\S]*profile\.displayName/,
      /accessibilityLabel="Show profile posts"/,
      /accessibilityState=\{\{ selected: activeShareTab === "posts" \}\}/,
      /accessibilityState=\{\{ selected: activeShareTab === "reviews" \}\}/,
      /navigation\.navigate\("Settings"\)/,
    ],
    "ProfileHomeScreen own profile",
  );
  assertSourceIncludes(
    userProfile,
    [
      /<ProfileScreenShell\s+title=\{authorName\}/,
      /Avatar name=\{authorName\} uri=\{resolvedAuthorAvatarUrl\}/,
      /label="Followers"/,
      /label="Following"/,
      /label="Reviews"/,
      /label="Stalls"/,
      /activeTab === "posts"/,
      /activeTab === "reviews"/,
      /post\.authorId === normalizedAuthorId/,
      /reviews\.getUserReviews\(normalizedAuthorId\)/,
      /rootNavigation\.navigate\(target, \{ userId: resolvedAuthorId/,
      /accessibilityState=\{\{ selected: activeTab === "posts" \}\}/,
      /accessibilityState=\{\{ selected: activeTab === "reviews" \}\}/,
    ],
    "UserProfileContent shared profile layout",
  );
  // Matching is by account id only; display names are not unique.
  assertSourceExcludes(
    userProfile,
    [
      /normalizePersonName/,
      /commentsByPostId/,
      /repliesByCommentId/,
      /chat\.listConversations/,
      /navigation\.navigate\("VisitedStalls"\)/,
      /screen: "Profile"/,
    ],
    "UserProfileContent id-only matching",
  );
  assert.doesNotMatch(profileHome, /post\.authorName\.toLowerCase\(\) === profile\.displayName/);
  assertSourceExcludes(
    userProfile,
    [/Taste Fingerprint/, /Detailed Analysis/],
    "other user profile",
  );
  assertSourceIncludes(
    connections,
    [
      /authorAvatarUrl: person\.avatarUrl/,
      /<Avatar name=\{person\.name\} uri=\{person\.avatarUrl\} size=\{44\}/,
      /avatarUrl: user\.avatarUrl \?\? ""/,
    ],
    "ProfileConnectionsScreen avatar consistency",
  );
  // Followers/Following lists come only from the server for the viewed profile,
  // never from feed, comment or chat authors.
  for (const forbidden of [
    /listSharedStallPosts/,
    /chat\.listConversations\(\)/,
    /commentsByPostId/,
    /repliesByCommentId/,
  ]) {
    assert.doesNotMatch(connections, forbidden);
  }
  assertSourceIncludes(
    settings,
    [
      /label="Profile visibility"/,
      /onPress: \(\) => void changeProfileVisibility\("public"\)/,
      /onPress: \(\) => void changeProfileVisibility\("private"\)/,
      /const saved = await setProfileVisibility\(visibility\)/,
    ],
    "Settings profile visibility UI",
  );
  assertSourceIncludes(
    profileStore,
    [
      /setProfileVisibility: async \(profileVisibility\) =>/,
      /profileVisibility,/,
      /getServiceProvider\(\)\.mode === "mock"/,
      /profile\.updateProfile\(\{ profileVisibility \}\)/,
    ],
    "profile visibility store",
  );
  assertSourceIncludes(
    supabaseService,
    [/account_visibility/, /privacy_settings/, /updates\.profileVisibility !== undefined/],
    "Supabase profile visibility mapping",
  );
  assertSourceIncludes(domain, [/export type ProfileVisibility = "public" \| "private"/], "domain");
});

test("coverage plan surfaces have direct source, Playwright, and native smoke entry points", () => {
  for (const pathFromRepoRoot of [
    "tests/e2e/auth.spec.ts",
    "tests/e2e/buttons-interactions.spec.ts",
    "tests/e2e/feed-profile-sync.spec.ts",
    "tests/e2e/cross-user-visibility.spec.ts",
    "src/app/native-smoke-contracts.test.ts",
    "src/app/screens/discover/home-map-edge-back-contracts.test.ts",
    "src/app/screens/review-feed-bites-contracts.test.ts",
    "src/app/screens/search/browse-grid-contracts.test.ts",
  ]) {
    assertRepoFileExists(pathFromRepoRoot);
  }
});
