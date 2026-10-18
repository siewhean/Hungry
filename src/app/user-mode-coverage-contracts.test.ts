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
      /EmailVerification: \{ email: string; completedOnboarding\?: boolean \} \| undefined/,
      /ForgotPassword: undefined/,
      /ResetPassword: \{ email\?: string; code\?: string \} \| undefined/,
      /TasteQuiz: \{ mode\?: "onboarding" \| "profile"; initialPhase\?: "taste" \| "dietary" \} \| undefined/,
      /LocationPermission: undefined/,
      /ManualLocationPicker: undefined/,
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
      /completeAuth\(\{ completedOnboarding: true, skippedTasteQuiz: true \}\)/,
    ],
    "LoginScreen",
  );
  assertSourceIncludes(
    signUp,
    [
      /getHungryService\(\)\.auth\.signUp\(/,
      /navigation\.navigate\("EmailVerification"/,
      /completeAuth\(\{[\s\S]*completedOnboarding: false/,
      /navigation\.getParent\(\)\?\.reset\(\{[\s\S]*OnboardingStack/,
    ],
    "SignUpScreen",
  );
  assertSourceIncludes(
    settings,
    [
      /const handleDeleteAccount = \(\) =>/,
      /purgePersistedAccountData\(\)/,
      /clearSession\(\)/,
      /clearProfile\(\)/,
      /rootNavigation\.navigate\("AuthStack", \{ screen: "SignUp" \}\)/,
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
      /navigation\.navigate\("LocationPermission"\)/,
    ],
    "TasteQuizScreen",
  );
  assertSourceIncludes(
    locationPermission,
    [/grantLocation\(\)/, /completeOnboarding\(hasSkippedTasteQuiz\)/, /ManualLocationPicker/],
    "LocationPermissionScreen",
  );
  assertSourceIncludes(
    manualLocation,
    [/setManualSelection/, /completeOnboarding\(hasSkippedTasteQuiz\)/],
    "ManualLocationPickerScreen",
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
      /numberOfLines=\{2\}/,
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

test("discover and search keep user mode map-free while browse grids open matching dish details", () => {
  const discover = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const quickBites = readRepoFile("src/app/screens/discover/QuickBitesScreen.tsx");
  const searchResults = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");
  const browseIndex = readRepoFile("src/features/search/browseIndex.ts");
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");

  assertSourceIncludes(
    discover,
    [
      /const isUserMode = !isDeveloperMode && !isMerchantMode/,
      /\{isUserMode \? null : \(/,
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
      /onPress=\{\(\) => navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\)\}/,
      /source=\{\{ uri: activeImageUrl \}\}/,
      /onError=\{\(\) =>/,
      /\{bite\.dishName\}/,
      /\{bite\.venueName\}/,
    ],
    "QuickBitesScreen search icon and card mapping",
  );
  assertSourceIncludes(
    browseIndex,
    [
      /dishById\.set\(dish\.id, dish\)/,
      /searchTextByDishId\.set\(dish\.id, toDishSearchText\(dish, venue\)\)/,
      /sortedDishesByVenueId\.set\(venue\.id, cloneSortedDishes\(dishes\)\)/,
    ],
    "browse index source of truth",
  );
  assertSourceIncludes(
    searchResults,
    [
      /title: dish\.name,[\s\S]*imageUrl: dish\.imageUrl,[\s\S]*dish,/,
      /title: topDish\.name,[\s\S]*imageUrl: topDish\.imageUrl,[\s\S]*dish: topDish/,
      /images=\{slides\.map\(\(slide\) => slide\.imageUrl\)\}/,
      /\{activeSlide\.title\}/,
      /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dish\.id \}\)/,
      /navigation\.navigate\("DishDetail", \{ dishId: dish\.id \}\)/,
      /onSubmitQuery=\{recordCommittedSearchQuery\}/,
      /rememberSearch\(filters\.query\)/,
    ],
    "SearchResultsScreen image-title-detail consistency",
  );
  assertSourceIncludes(
    rootNavigator,
    [/name="BrowseDishes"/, /name="BrowseStalls"/, /name="DecideForMeResult"/, /name="WheelStack"/],
    "root navigator discover routes",
  );
});

test("dish and stall details expose correct detail surfaces without user-mode map/cart regressions", () => {
  const dishDetail = readRepoFile("src/app/screens/detail/DishDetailScreen.tsx");
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
      /const gallery = useMemo\(\(\) => \(dish \? buildDishGallery\(dish\) : \[\]\), \[dish\]\)/,
      /<ImageCarousel images=\{gallery\} width=\{screenWidth\} height=\{screenWidth \* 0\.75\}>/,
      /dish\.tasteVector\[dimension\.key\]/,
      /visibleReviews\.map/,
      /getHungryService\(\)\s*\.reviews\.getReviewsForDish\(dish\.id\)/,
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
      /logoUrl=\{venue\.logoUrl\}/,
      /<ChevronRight color=\{palette\.textMuted\} size=\{24\} \/>/,
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
      /useDelayedLoadingSkeleton\(\s*isInitialLoading/,
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
      /accessibilityLabel="Edit with AI"[\s\S]*onPress=\{\(\) => setEditingMediaId\(item\.id\)\}/,
      /accessibilityLabel="Open video edit tools"[\s\S]*onPress=\{\(\) => setEditingMediaId\(item\.id\)\}/,
    ],
    "MediaManager validation and carousel media entry",
  );
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
      /accessibilityLabel="Edit profile photo"/,
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
      /ProfileScreenShell title=\{authorName\}/,
      /Avatar name=\{authorName\} uri=\{resolvedAuthorAvatarUrl\}/,
      /label="Followers"/,
      /label="Following"/,
      /label="Reviews"/,
      /label="Stalls"/,
      /activeTab === "posts"/,
      /activeTab === "reviews"/,
      /normalizedAuthorId[\s\S]*post\.authorId === normalizedAuthorId[\s\S]*normalizePersonName\(post\.authorName\) === normalizedAuthorName/,
    ],
    "UserProfileContent shared profile layout",
  );
  assertSourceExcludes(
    userProfile,
    [/Taste Fingerprint/, /Detailed Analysis/],
    "other user profile",
  );
  assertSourceIncludes(
    connections,
    [
      /authorAvatarUrl: person\.avatarUrl/,
      /authorLocation: person\.location/,
      /<Avatar name=\{person\.name\} uri=\{person\.avatarUrl\} size=\{44\}/,
      /listSharedStallPosts/,
      /chat\.listConversations\(\)/,
      /commentsByPostId/,
      /repliesByCommentId/,
    ],
    "ProfileConnectionsScreen avatar consistency",
  );
  assertSourceIncludes(
    settings,
    [
      /label="Profile visibility"/,
      /onPress: \(\) => setProfileVisibility\("public"\)/,
      /onPress: \(\) => setProfileVisibility\("private"\)/,
    ],
    "Settings profile visibility UI",
  );
  assertSourceIncludes(
    profileStore,
    [
      /setProfileVisibility: \(profileVisibility\) =>/,
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
