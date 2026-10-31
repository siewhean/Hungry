// One row per screen: where it lives, who is looking at it, what it should show once the mock
// data has loaded. `screens.render.test.tsx` renders every row and fails if a screen exists
// that has no row, so a new screen cannot ship without being rendered by a test.
//
// `known` marks console errors a screen is already known to log. They are real defects (see the
// note on each); remove the entry when the defect is fixed. An error that is not listed fails.

import type { Scenario } from "./sessions";

export type KnownRenderError = "BACK_HANDLER" | "NESTED_BUTTON";

/** Patterns for console errors that are accepted for now, with why. */
export const KNOWN_RENDER_ERRORS: Record<KnownRenderError, { pattern: RegExp; why: string }> = {
  BACK_HANDLER: {
    pattern: /BackHandler is not supported on web/,
    why: "react-native-web warns when a screen subscribes to the Android back button; harmless on web.",
  },
  NESTED_BUTTON: {
    pattern: /cannot be a descendant of|cannot contain a nested/,
    why: "Web fallback map: a building marker button contains the BuildingPin button (invalid HTML on web).",
  },
};

export type ParamKey =
  | "postRoute"
  | "catalogDish"
  | "chat"
  | "checklist"
  | "checklistPicker"
  | "dish"
  | "dishReviews"
  | "portfolio"
  | "portfolioPicker"
  | "report"
  | "review"
  | "socialGrid"
  | "socialPost"
  | "stall"
  | "stallVisited"
  | "story"
  | "otherUser";

export interface ScreenRow {
  name: string;
  file: string;
  scenario: Scenario;
  expect: RegExp;
  params?: ParamKey;
  known?: KnownRenderError;
}

export const SCREEN_MATRIX: readonly ScreenRow[] = [
  {
    name: "SplashScreen",
    file: "src/app/screens/SplashScreen.tsx",
    scenario: "user",
    expect: /Find the dish\. Not just the restaurant\./,
  },
  {
    name: "EmailChangeScreen",
    file: "src/app/screens/auth/EmailChangeScreen.tsx",
    scenario: "user",
    expect: /We couldn't confirm that here/,
  },
  {
    name: "EmailVerificationScreen",
    file: "src/app/screens/auth/EmailVerificationScreen.tsx",
    scenario: "user",
    expect: /Verify your email/,
  },
  {
    name: "ForgotPasswordScreen",
    file: "src/app/screens/auth/ForgotPasswordScreen.tsx",
    scenario: "user",
    expect: /Forgot password/,
  },
  {
    name: "LoginScreen",
    file: "src/app/screens/auth/LoginScreen.tsx",
    scenario: "user",
    expect: /Sign in to Hungry/,
  },
  {
    name: "ResetPasswordScreen",
    file: "src/app/screens/auth/ResetPasswordScreen.tsx",
    scenario: "user",
    expect: /Set a new password/,
  },
  {
    name: "ResetPasswordSuccessScreen",
    file: "src/app/screens/auth/ResetPasswordSuccessScreen.tsx",
    scenario: "user",
    expect: /Password updated/,
  },
  {
    name: "SignUpScreen",
    file: "src/app/screens/auth/SignUpScreen.tsx",
    scenario: "user",
    expect: /Create account/,
  },
  {
    name: "CatalogRawDetailScreen",
    file: "src/app/screens/catalog/CatalogRawDetailScreen.tsx",
    scenario: "user",
    expect: /Chicken Rice/,
    params: "catalogDish",
  },
  {
    name: "ChecklistDetailScreen",
    file: "src/app/screens/checklist/ChecklistDetailScreen.tsx",
    scenario: "user",
    expect: /Nothing here yet/,
    params: "checklist",
  },
  {
    name: "ChecklistItemPickerScreen",
    file: "src/app/screens/checklist/ChecklistItemPickerScreen.tsx",
    scenario: "user",
    expect: /Add dish/,
    params: "checklistPicker",
  },
  {
    name: "ChecklistsHomeScreen",
    file: "src/app/screens/checklist/ChecklistsHomeScreen.tsx",
    scenario: "user",
    expect: /My checklists/,
  },
  {
    name: "DishDetailScreenV2",
    file: "src/app/screens/detail/DishDetailScreenV2.tsx",
    scenario: "user",
    expect: /Tian Tian Chicken Rice/,
    params: "dish",
  },
  {
    name: "DishReviewsScreen",
    file: "src/app/screens/detail/DishReviewsScreen.tsx",
    scenario: "user",
    expect: /Reviews/,
    params: "dishReviews",
  },
  {
    name: "MerchantClaimExplainerScreen",
    file: "src/app/screens/detail/MerchantClaimExplainerScreen.tsx",
    scenario: "user",
    expect: /Claim Verification/,
  },
  {
    name: "StallVisitedScreen",
    file: "src/app/screens/detail/StallVisitedScreen.tsx",
    scenario: "user",
    expect: /Visited/,
    params: "stallVisited",
  },
  {
    name: "NotFoundScreen",
    file: "src/app/screens/detail/NotFoundScreen.tsx",
    scenario: "user",
    expect: /The kitchen is currently quiet/,
  },
  {
    name: "OfflineStateScreen",
    file: "src/app/screens/detail/OfflineStateScreen.tsx",
    scenario: "user",
    expect: /Offline mode/,
  },
  {
    name: "StallDetailScreen",
    file: "src/app/screens/detail/StallDetailScreen.tsx",
    scenario: "user",
    expect: /Tian Tian Chicken Rice/,
    params: "stall",
  },
  {
    name: "DesignGalleryScreen",
    file: "src/app/screens/dev/DesignGalleryScreen.tsx",
    scenario: "user",
    expect: /Design Gallery V2/,
  },
  {
    name: "DeveloperLauncherScreen",
    file: "src/app/screens/dev/DeveloperLauncherScreen.tsx",
    scenario: "user",
    expect: /Developer Launcher/,
  },
  {
    name: "CraveScreen",
    file: "src/app/screens/discover/CraveScreen.tsx",
    scenario: "user",
    expect: /Crave/,
  },
  {
    name: "DecideForMeQuizScreen",
    file: "src/app/screens/discover/DecideForMeQuizScreen.tsx",
    scenario: "user",
    expect: /What kind of food\?|Where are you eating\?/,
  },
  {
    name: "DecideForMeResultScreen",
    file: "src/app/screens/discover/DecideForMeResultScreen.tsx",
    scenario: "user",
    expect: /Your pick/,
  },
  {
    name: "DiscoverHomeScreen",
    file: "src/app/screens/discover/DiscoverHomeScreen.tsx",
    scenario: "user",
    expect: /Choose where you are|You are at|Across Singapore/,
  },
  {
    name: "DiscoverEntryScreen",
    file: "src/app/screens/discover/DiscoverEntryScreen.tsx",
    scenario: "user",
    // Mock mode renders DiscoverHomeScreen; the Supabase branch (live feed, offline hand-off)
    // is covered in src/app/screens/discover/DiscoverEntryScreen.render.test.tsx.
    expect: /Choose where you are|You are at|Across Singapore/,
  },
  {
    name: "HomeMapScreen",
    file: "src/app/screens/discover/HomeMapScreen.tsx",
    scenario: "user",
    expect: /Map unavailable/,
  },
  {
    name: "MapZoomedInScreen",
    file: "src/app/screens/discover/MapZoomedInScreen.tsx",
    scenario: "user",
    expect: /Maxwell/,
    known: "NESTED_BUTTON",
  },
  {
    name: "QuickBitesScreen",
    file: "src/app/screens/discover/QuickBitesScreen.tsx",
    scenario: "user",
    expect: /Dishes near you/,
  },
  {
    name: "ActivityInboxScreen",
    file: "src/app/screens/home/ActivityInboxScreen.tsx",
    scenario: "user",
    expect: /Activity/,
  },
  {
    name: "ActivityPostDetailScreen",
    file: "src/app/screens/home/ActivityPostDetailScreen.tsx",
    scenario: "user",
    expect: /Chicken Rice/,
    params: "postRoute",
  },
  {
    name: "AddStoryScreen",
    file: "src/app/screens/home/AddStoryScreen.tsx",
    scenario: "user",
    expect: /Gallery/,
  },
  {
    name: "ChatDetailScreen",
    file: "src/app/screens/home/ChatDetailScreen.tsx",
    scenario: "user",
    expect: /Ahmad/,
    params: "chat",
  },
  {
    name: "DirectMessagesScreen",
    file: "src/app/screens/home/DirectMessagesScreen.tsx",
    scenario: "user",
    expect: /Messages/,
  },
  {
    name: "HomeFeedScreen",
    file: "src/app/screens/home/HomeFeedScreen.tsx",
    scenario: "user",
    expect: /Decide for me|Share in Hungry|Share post/,
  },
  {
    name: "StoryViewerScreen",
    file: "src/app/screens/home/StoryViewerScreen.tsx",
    scenario: "user",
    expect: /Your Story/,
    params: "story",
  },
  {
    name: "AIAssistantScreen",
    file: "src/app/screens/merchant/AIAssistantScreen.tsx",
    scenario: "merchant",
    expect: /Insights/,
  },
  {
    name: "BusinessProfileEditorScreen",
    file: "src/app/screens/merchant/BusinessProfileEditorScreen.tsx",
    scenario: "merchant",
    expect: /Business profile/,
    known: "BACK_HANDLER",
  },
  {
    name: "CustomerInboxScreen",
    file: "src/app/screens/merchant/CustomerInboxScreen.tsx",
    scenario: "merchant",
    expect: /Customer inbox/,
  },
  {
    name: "DishEditorScreen",
    file: "src/app/screens/merchant/DishEditorScreen.tsx",
    scenario: "merchant",
    expect: /Add dish/,
    known: "BACK_HANDLER",
  },
  {
    name: "FeaturedVisitorsScreen",
    file: "src/app/screens/merchant/FeaturedVisitorsScreen.tsx",
    scenario: "merchant",
    expect: /Featured visitors/,
  },
  {
    name: "HomeBasedVerificationScreen",
    file: "src/app/screens/merchant/HomeBasedVerificationScreen.tsx",
    scenario: "merchant",
    expect: /Home-Based Verification/,
  },
  {
    name: "MerchantAnalyticsScreen",
    file: "src/app/screens/merchant/MerchantAnalyticsScreen.tsx",
    scenario: "merchant",
    expect: /Performance/,
  },
  {
    name: "MerchantDashboardScreen",
    file: "src/app/screens/merchant/MerchantDashboardScreen.tsx",
    scenario: "merchant",
    expect: /Uncle Tan's Wonton Mee/,
  },
  {
    name: "MerchantMenuScreen",
    file: "src/app/screens/merchant/MerchantMenuScreen.tsx",
    scenario: "merchant",
    expect: /Menu/,
  },
  {
    name: "MerchantProfileScreen",
    file: "src/app/screens/merchant/MerchantProfileScreen.tsx",
    scenario: "merchant",
    expect: /Stall profile/,
  },
  {
    name: "MerchantSettingsScreen",
    file: "src/app/screens/merchant/MerchantSettingsScreen.tsx",
    scenario: "merchant",
    expect: /Settings/,
  },
  {
    name: "OCRDraftScreen",
    file: "src/app/screens/merchant/OCRDraftScreen.tsx",
    scenario: "merchant",
    expect: /Photo drafts/,
  },
  {
    name: "PromotionBuilderScreen",
    file: "src/app/screens/merchant/PromotionBuilderScreen.tsx",
    scenario: "merchant",
    expect: /New promotion/,
    known: "BACK_HANDLER",
  },
  {
    name: "PromotionListScreen",
    file: "src/app/screens/merchant/PromotionListScreen.tsx",
    scenario: "merchant",
    expect: /Promotions/,
  },
  {
    name: "VerificationCentreScreen",
    file: "src/app/screens/merchant/VerificationCentreScreen.tsx",
    scenario: "merchant",
    expect: /Verification centre/,
  },
  {
    name: "FoodOpennessScreen",
    file: "src/app/screens/onboarding/FoodOpennessScreen.tsx",
    scenario: "user",
    expect: /How open are you to trying new food/,
  },
  {
    name: "LocationPermissionScreen",
    file: "src/app/screens/onboarding/LocationPermissionScreen.tsx",
    scenario: "user",
    expect: /Step 1 of 5/,
  },
  {
    name: "ManualLocationPickerScreen",
    file: "src/app/screens/onboarding/ManualLocationPickerScreen.tsx",
    scenario: "user",
    expect: /Use my current location/,
  },
  {
    name: "OnboardingAuthScreen",
    file: "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
    scenario: "user",
    expect: /taste profile/,
  },
  {
    name: "MandatoryOnboardingAuthScreen",
    file: "src/app/screens/onboarding/MandatoryOnboardingAuthScreen.tsx",
    scenario: "user",
    expect: /taste profile/,
  },
  {
    name: "TasteProfileResultScreen",
    file: "src/app/screens/onboarding/TasteProfileResultScreen.tsx",
    scenario: "user",
    expect: /You're all set/,
  },
  {
    name: "TasteQuizScreen",
    file: "src/app/screens/onboarding/TasteQuizScreen.tsx",
    scenario: "user",
    expect: /How sweet do you like your food/,
  },
  {
    name: "WelcomeScreen",
    file: "src/app/screens/onboarding/WelcomeScreen.tsx",
    scenario: "user",
    expect: /Find the dish/,
  },
  {
    name: "AdminPortfolioFlagsScreen",
    file: "src/app/screens/portfolio/AdminPortfolioFlagsScreen.tsx",
    scenario: "user",
    expect: /Portfolio flags/,
  },
  {
    name: "PortfolioCollaboratorsScreen",
    file: "src/app/screens/portfolio/PortfolioCollaboratorsScreen.tsx",
    scenario: "user",
    expect: /Collaborators/,
    params: "portfolio",
  },
  {
    name: "PortfolioCreateScreen",
    file: "src/app/screens/portfolio/PortfolioCreateScreen.tsx",
    scenario: "user",
    expect: /Create list/,
  },
  {
    name: "PortfolioDetailScreen",
    file: "src/app/screens/portfolio/PortfolioDetailScreen.tsx",
    scenario: "user",
    expect: /Render test list/,
    params: "portfolio",
  },
  {
    name: "PortfolioEditScreen",
    file: "src/app/screens/portfolio/PortfolioEditScreen.tsx",
    scenario: "user",
    expect: /Edit list/,
    params: "portfolio",
  },
  {
    name: "PortfolioItemPickerScreen",
    file: "src/app/screens/portfolio/PortfolioItemPickerScreen.tsx",
    scenario: "user",
    expect: /Add dish/,
    params: "portfolioPicker",
  },
  {
    name: "PortfolioPublicViewScreen",
    file: "src/app/screens/portfolio/PortfolioPublicViewScreen.tsx",
    scenario: "user",
    expect: /Hungry list/,
    params: "portfolio",
  },
  {
    name: "PortfolioSearchScreen",
    file: "src/app/screens/portfolio/PortfolioSearchScreen.tsx",
    scenario: "user",
    expect: /Search lists/,
  },
  {
    name: "PortfoliosHomeScreen",
    file: "src/app/screens/portfolio/PortfoliosHomeScreen.tsx",
    scenario: "user",
    expect: /Your lists/,
  },
  {
    name: "PostComposerScreen",
    file: "src/app/screens/post/PostComposerScreen.tsx",
    scenario: "user",
    expect: /Create post/,
  },
  {
    name: "PostComposerScreenV2",
    file: "src/app/screens/post/PostComposerScreenV2.tsx",
    scenario: "user",
    expect: /New post/,
  },
  {
    name: "AddStallScreen",
    file: "src/app/screens/profile/AddStallScreen.tsx",
    scenario: "user",
    expect: /Add a stall/,
  },
  {
    name: "BlockedAndHiddenScreen",
    file: "src/app/screens/profile/BlockedAndHiddenScreen.tsx",
    scenario: "user",
    // Hidden posts belong to the archived social feed, so only blocks list while it is off.
    expect: /Blocked people/,
  },
  {
    name: "ChangePasswordScreen",
    file: "src/app/screens/profile/ChangePasswordScreen.tsx",
    scenario: "user",
    expect: /Change password/,
  },
  {
    name: "EditProfileScreen",
    file: "src/app/screens/profile/EditProfileScreen.tsx",
    scenario: "user",
    expect: /Edit profile/,
  },
  {
    name: "FavouritesScreen",
    file: "src/app/screens/profile/FavouritesScreen.tsx",
    scenario: "user",
    expect: /Saved/,
  },
  {
    name: "FollowRequestsScreen",
    file: "src/app/screens/profile/FollowRequestsScreen.tsx",
    scenario: "user",
    expect: /Follow requests/,
  },
  {
    name: "FollowedStallsScreen",
    file: "src/app/screens/profile/FollowedStallsScreen.tsx",
    scenario: "user",
    expect: /Followed stalls/,
  },
  {
    name: "ListsHomeScreen",
    file: "src/app/screens/profile/ListsHomeScreen.tsx",
    scenario: "user",
    expect: /Lists/,
  },
  {
    name: "ReportProblemScreen",
    file: "src/app/screens/detail/ReportProblemScreen.tsx",
    scenario: "user",
    params: "report",
    expect: /What's wrong\?/,
  },
  {
    name: "CollectionsScreen",
    file: "src/app/screens/profile/CollectionsScreen.tsx",
    scenario: "user",
    expect: /Want to try/,
  },
  {
    name: "MissionsScreen",
    file: "src/app/screens/profile/MissionsScreen.tsx",
    scenario: "user",
    expect: /Weekly missions/,
  },
  {
    name: "PassportScreen",
    file: "src/app/screens/profile/PassportScreen.tsx",
    scenario: "user",
    expect: /HUNGRY PASSPORT/,
  },
  {
    name: "FollowersScreen",
    file: "src/app/screens/profile/ProfileConnectionsScreen.tsx",
    scenario: "user",
    expect: /Followers/,
  },
  {
    name: "FollowingScreen",
    file: "src/app/screens/profile/ProfileConnectionsScreen.tsx",
    scenario: "user",
    expect: /Followers/,
  },
  {
    name: "ProfileHomeScreen",
    file: "src/app/screens/profile/ProfileHomeScreen.tsx",
    scenario: "user",
    expect: /Taste Fingerprint/,
  },
  {
    name: "ReleaseProfileScreen",
    file: "src/app/screens/profile/ReleaseProfileScreen.tsx",
    scenario: "user",
    expect: /Settings and privacy/,
  },
  {
    name: "ReviewHistoryScreen",
    file: "src/app/screens/profile/ReviewHistoryScreen.tsx",
    scenario: "user",
    expect: /Your reviews/,
  },
  {
    name: "SettingsScreen",
    file: "src/app/screens/profile/SettingsScreen.tsx",
    scenario: "user",
    expect: /Settings/,
  },
  {
    name: "SocialGridScreen",
    file: "src/app/screens/profile/SocialGridScreen.tsx",
    scenario: "user",
    expect: /Saved content/,
    params: "socialGrid",
  },
  {
    name: "SocialPostDetailScreen",
    file: "src/app/screens/profile/SocialPostDetailScreen.tsx",
    scenario: "user",
    expect: /Saved post/,
    params: "socialPost",
  },
  {
    name: "StallSubmissionsScreen",
    file: "src/app/screens/profile/StallSubmissionsScreen.tsx",
    scenario: "user",
    expect: /My submissions/,
  },
  {
    name: "UserProfileScreen",
    file: "src/app/screens/profile/UserProfileScreen.tsx",
    scenario: "user",
    expect: /Emma/,
    params: "otherUser",
  },
  {
    name: "VisitedStallsScreen",
    file: "src/app/screens/profile/VisitedStallsScreen.tsx",
    scenario: "user",
    expect: /Visited stalls/,
  },
  {
    name: "MusicSelectionScreen",
    file: "src/app/screens/review/MusicSelectionScreen.tsx",
    scenario: "user",
    expect: /Soundtrack/,
  },
  {
    name: "ReviewDetailScreen",
    file: "src/app/screens/review/ReviewDetailScreen.tsx",
    scenario: "user",
    expect: /Chicken Rice/,
    params: "review",
  },
  {
    name: "ReviewFeedScreen",
    file: "src/app/screens/review/ReviewFeedScreen.tsx",
    scenario: "user",
    expect: /Reviews/,
  },
  {
    name: "ReviewScreen",
    file: "src/app/screens/review/ReviewScreen.tsx",
    scenario: "user",
    expect: /Write a review/,
  },
  {
    name: "DishSearchScreen",
    file: "src/app/screens/search/DishSearchScreen.tsx",
    scenario: "user",
    expect: /Dishes to Discover/,
  },
  {
    name: "BrowseDishesScreen",
    file: "src/app/screens/search/SearchResultsScreen.tsx",
    scenario: "user",
    expect: /Under S\$6/,
  },
  {
    name: "BrowseStallsScreen",
    file: "src/app/screens/search/SearchResultsScreen.tsx",
    scenario: "user",
    expect: /Under S\$6/,
  },
  {
    name: "SearchResultsScreen",
    file: "src/app/screens/search/SearchResultsScreen.tsx",
    scenario: "user",
    expect: /Dishes/,
  },
  {
    name: "WheelHomeScreen",
    file: "src/app/screens/wheel/WheelHomeScreen.tsx",
    scenario: "user",
    expect: /Hungry Wheel/,
  },
  {
    name: "WheelLobbyScreen",
    file: "src/app/screens/wheel/WheelLobbyScreen.tsx",
    scenario: "user",
    expect: /Your wheel/,
  },
  {
    name: "WheelSpinScreen",
    file: "src/app/screens/wheel/WheelSpinScreen.tsx",
    scenario: "user",
    expect: /This wheel has ended/,
  },
];
