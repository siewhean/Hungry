import type { NavigatorScreenParams } from "@react-navigation/native";
import type { TasteVector } from "@/types/domain";

export type AuthStackParamList = {
  /**
   * title: why the user is signing in ("Sign in to save Chicken Rice"), from the guest sheet.
   * email: fills the email field (from the verify screen).
   */
  Login: { title?: string; email?: string } | undefined;
  SignUp: undefined;
  EmailVerification: { email?: string; completedOnboarding?: boolean; code?: string } | undefined;
  /** The link a signed-in user opens to confirm a new sign-in email (hungry://auth/email-change). */
  EmailChange: { code?: string } | undefined;
  ForgotPassword: undefined;
  /**
   * recoveryVerified: the emailed code was already verified (ForgotPassword).
   * linkError: the reset link came back with an error (expired, already used).
   */
  ResetPassword:
    | {
        email?: string;
        code?: string;
        recoveryVerified?: boolean;
        linkError?: "expired" | "invalid";
      }
    | undefined;
  ResetPasswordSuccess: undefined;
};

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  TasteQuiz: { mode?: "onboarding" | "profile"; initialPhase?: "taste" | "dietary" } | undefined;
  DietaryPreferences:
    | {
        mode?: "onboarding" | "profile";
        initialPhase?: "taste" | "dietary";
        /** Taste answers carried over from the TasteQuiz route. */
        answers?: TasteVector;
      }
    | undefined;
  /** "How open are you to trying new food?" mode "settings": change it from Settings and go back. */
  FoodOpenness: { mode?: "onboarding" | "settings" } | undefined;
  /** Last step: "you're all set", then Home. */
  TasteProfileResult: undefined;
  LocationPermission: undefined;
  /** mode "settings": change the location from Settings and go back, without onboarding. */
  ManualLocationPicker: { mode?: "settings" } | undefined;
  OnboardingAuth: undefined;
};
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Favourites: undefined;
  /** One Lists area: Saved, your lists (portfolios) and checklists. */
  ListsHome: undefined;
  ReviewHistory: undefined;
  Followers: { userId?: string; userDisplayName?: string } | undefined;
  Following: { userId?: string; userDisplayName?: string } | undefined;
  VisitedStalls: undefined;
  FollowedStalls: undefined;
  Settings: undefined;
  SocialGrid: { type: "liked" | "saved" };
  SocialPostDetail: { postId: string; type: "liked" | "saved" };
  EditProfile: undefined;
  AddStall: undefined;
  /** Your submitted stalls and their review status. */
  StallSubmissions: undefined;
  ReviewFlow: undefined;
  ChecklistsHome: undefined;
  ChecklistDetail: { checklistId: string };
  ChecklistItemPicker: { checklistId: string; mode: "dish" | "stall" | "custom" };
  PortfoliosHome: undefined;
  PortfolioDetail: { portfolioId: string };
  PortfolioCreate: undefined;
  PortfolioEdit: { portfolioId: string };
  PortfolioItemPicker: { portfolioId: string; mode: "dish" | "stall" };
  PortfolioCollaborators: { portfolioId: string };
  PortfolioSearch: undefined;
};

export type ReviewStackParamList = {
  ReviewMain: { venueId?: string; dishId?: string } | undefined;
};

export type WheelStackParamList = {
  WheelHome: { code?: string } | undefined;
  WheelLobby: { partyId: string };
  WheelSpin: { partyId: string };
  WheelResult: { partyId: string; winnerEntryId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Review: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type MerchantTabParamList = {
  // Section landing pages
  Dashboard: undefined;
  Menu: undefined;
  Analytics: undefined;
  Profile: undefined;
  // Extended sections
  VerificationCentre: undefined;
  HomeBasedVerification: undefined;
  BusinessProfileEditor: undefined;
  DishEditor: { dishId?: string; ocrDraftId?: string } | undefined;
  OCRDrafts: undefined;
  CustomerInbox: undefined;
  FeaturedVisitors: undefined;
  PromotionBuilder: { promotionId?: string; duplicateFromId?: string } | undefined;
  PromotionList: undefined;
  AIAssistant: undefined;
  MerchantSettings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  MerchantTabs: NavigatorScreenParams<MerchantTabParamList>;
  StallDetail: { venueId?: string; id?: string };
  MerchantClaimExplainer: undefined;
  DishDetail: { dishId?: string; id?: string };
  CatalogRawDetail: { kind: "dish" | "venue"; id: string; releaseId?: string };
  SearchHome: undefined;
  SearchResults:
    | {
        browseMode?: "dishes" | "stalls";
        initialQuery?: string;
        foodTypeTag?: string;
        initialFilter?:
          | "All"
          | "Local"
          | "Halal"
          | "Japanese"
          | "Western"
          | "Noodles"
          | "Rice"
          | "Spicy";
      }
    | undefined;
  BrowseDishes: undefined;
  BrowseStalls: undefined;
  DiscoverMap: undefined;
  DecideForMeResult: { surface?: "home" | "discover" | "push" } | undefined;
  MapZoomedIn: { buildingId: string };
  ReviewStack: NavigatorScreenParams<ReviewStackParamList>;
  WheelStack: NavigatorScreenParams<WheelStackParamList>;
  ActivityInbox: { initialTab?: "messages" | "updates" } | undefined;
  ActivityPostDetail: { postId: string; updateId?: string };
  /** One review on its own page; opened by review/:reviewId share links. */
  ReviewDetail: { reviewId: string };
  FollowRequests: undefined;
  /** People the viewer blocked and posts they hid, with Unblock and Unhide. */
  BlockedAndHidden: undefined;
  /** Another user's follower/following lists, opened from their profile. */
  UserFollowers: { userId: string; userDisplayName?: string };
  UserFollowing: { userId: string; userDisplayName?: string };
  DirectMessages: undefined;
  ChatDetail: { chatId: string; name: string; avatar: string; isOnline?: boolean };
  Crave: undefined;
  MusicSelection: undefined;
  UserProfile: {
    /** Omitted by user/:id deep links; the screen loads the public name. */
    authorName?: string;
    authorAvatarUrl?: string;
    authorLocation?: string;
    reviewSignalLabel?: string;
    authorId?: string;
  };
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
  Post: { venueId?: string; dishId?: string } | undefined;
  QuickBites:
    | {
        collection?: "quickBites" | "trending" | "editorChoice" | "budget" | "lateNight";
        /** The Discover area the list was opened from; GPS is used when absent. */
        latitude?: number;
        longitude?: number;
      }
    | undefined;
  DeveloperLauncher: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  DesignGallery: undefined;
  // V2 Prototypes
  PostComposerV2: { venueId?: string; dishId?: string } | undefined;
  StoryViewer: { initialStoryId: string };
  AddStory: undefined;
  // Gamification
  PassportScreen: undefined;
  MissionsScreen: undefined;
  // Shared list (root-level access); list detail screens live in ProfileStack only.
  // `follow` finishes the Save tap that sent a signed-out visitor to sign in.
  PortfolioPublicView: { portfolioId: string; follow?: boolean };
  AdminPortfolioFlags: undefined;
};
