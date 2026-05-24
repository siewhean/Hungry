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
      /EmailVerification: \{ email: string \} \| undefined/,
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
      /commentsSheetRef\.current\?\.present\(\)/,
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
      /navigation\.navigate\("DecideForMeResult"\)/,
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
      /source=\{\{ uri: bite\.photoUrl \}\}/,
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
      /source=\{\{ uri: item\.imageUrl \}\}/,
      /\{item\.title\}/,
      /navigation\.navigate\("DishDetail", \{ dishId: item\.dish\.id \}\)/,
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
      /dish\.reviews\.map/,
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
      /<AppText variant="h2">Address<\/AppText>/,
      /\{stallAddress\}/,
      /<AppText variant="h2">Menu<\/AppText>/,
      /dishes\.map\(\(dish\) =>/,
      /navigation\.navigate\("DishDetail", \{ dishId: dish\.id \}\)/,
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
    ],
    "StallDetailScreen removed map/cart/rating/fade regressions",
  );
  assert.match(
    userModeStallPress,
    /navigation\.navigate\("StallDetail", \{ venueId: venue\.id \}\)/,
  );
});

test("review tab covers loading state, review cards, and bite card icon/sheet boundaries", () => {
  const reviewFeed = readRepoFile("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewFeedV2 = readRepoFile("src/app/screens/review/ReviewFeedScreenV2.tsx");
  const bitesContract = readRepoFile("src/app/screens/review-feed-bites-contracts.test.ts");

  for (const source of [reviewFeed, reviewFeedV2]) {
    assertSourceIncludes(
      source,
      [
        /useDelayedLoadingSkeleton\(isInitialLoading/,
        /ReviewFeedSkeleton/,
        /ReviewCommentsSheet/,
        /ReviewShareSheet/,
        /commentsEnabled=\{commentsEnabled\}/,
        /commentsSheetRef\.current\?\.present\(\)/,
        /accessibilityLabel="Open review comments"/,
        /accessibilityLabel=\{interaction\.liked \? "Unlike review" : "Like review"\}/,
        /accessibilityLabel=\{interaction\.saved \? "Unsave review" : "Save review"\}/,
        /<Send[\s\S]*<Bookmark[\s\S]*<CommentIcon[\s\S]*<Heart/,
        /justifyContent: "flex-end"/,
      ],
      "review feed card actions",
    );
    assertSourceExcludes(
      source,
      [/BiteCommentsSheet/, /activeCommentBite/, /getHomeBitesFeed\(\)/],
      "review feed bite sheet regressions",
    );
  }

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
  const sharedMetadata = readRepoFile("src/features/post/components/SharedMetadata.tsx");
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
      /await publishComposerPost\(\{ publishMode, routeDishId, routeVenueId \}\)/,
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
  assertSourceIncludes(
    sharedMetadata,
    [/toggleTag\(tag, "food"\)/, /toggleTag\(tag, "taste"\)/, /tasteTags\.includes\(tag\)/],
    "SharedMetadata tags",
  );
  assertSourceIncludes(
    publishing,
    [
      /const mediaUrls = media\.length \? media\.map\(\(item\) => item\.uri\) : \[fallbackImageUrl\]/,
      /caption = state\.postCaption\.trim\(\) \|\| state\.reviewCaption\.trim\(\) \|\| dish\.name/,
      /mediaUrls,/,
      /tags: \[\.\.\.state\.foodTags, \.\.\.state\.tasteTags\]/,
      /usePublishedPostStore\.getState\(\)\.upsertPost\(post\)/,
    ],
    "publishComposerPost data contract",
  );
  assertSourceIncludes(
    store,
    [/postCaption: ""/, /reviewCaption: ""/, /media: \[\]/, /foodTags: \[\]/, /tasteTags: \[\]/],
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
      /profile\.avatarUrl \? \([\s\S]*<Image[\s\S]*source=\{\{ uri: profile\.avatarUrl \}\}/,
      /avatarInitials/,
      /<UserProfileContent[\s\S]*authorName=\{viewerAuthorName\}[\s\S]*authorAvatarUrl=\{viewerAuthorAvatarUrl\}/,
      /<AppText variant="h2">Taste Fingerprint<\/AppText>/,
      /label="Followers"/,
      /label="Following"/,
      /label="Reviews"/,
      /label="Stalls"/,
      /label="Saved"/,
      /accessibilityLabel=\{menuOpen \? "Close quick access" : "Open quick access"\}/,
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
      /label="Saved"/,
      /activeTab === "posts"/,
      /activeTab === "reviews"/,
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
