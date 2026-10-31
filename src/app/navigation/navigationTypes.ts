import type { NavigatorScreenParams } from "@react-navigation/native";
import type { DecideAnswers } from "@/features/discovery/decideQuiz";
import type { DishPrefill } from "@/features/detail/dishPrefill";
import type { DishDetailSource } from "@/features/detail/dishSources";

export type AuthStackParamList = {
  /**
   * title: why the user is signing in ("Sign in to save Chicken Rice"), from the guest sheet.
   * email: fills the email field (from the verify screen).
   */
  Login: { title?: string; email?: string } | undefined;
  SignUp: undefined;
  // `code` / `error` arrive from the hungry://auth/confirm and
  // hungry://auth/callback Supabase PKCE deep links (see linking.ts).
  EmailVerification:
    | {
        email?: string;
        completedOnboarding?: boolean;
        code?: string;
        error?: "expired" | "invalid";
      }
    | undefined;
  /** The link a signed-in user opens to confirm a new sign-in email (hungry://auth/email-change). */
  /** otherLinkPending: the first of two double-confirmation links was accepted. */
  EmailChange: { code?: string; otherLinkPending?: boolean } | undefined;
  /**
   * fromSignedIn: opened by a signed-in user ("Forgot current password?" on ChangePassword),
   * who stays signed in and returns there; email fills the field.
   */
  ForgotPassword: { email?: string; fromSignedIn?: boolean } | undefined;
  /**
   * recoveryVerified: the emailed code was already verified (ForgotPassword).
   * fromSignedIn: the user was signed in before the reset, so leaving does not sign out.
   * error / linkError: the reset link came back with an error (expired, already used).
   */
  ResetPassword:
    | {
        email?: string;
        code?: string;
        error?: "expired" | "invalid";
        recoveryVerified?: boolean;
        fromSignedIn?: boolean;
        linkError?: "expired" | "invalid";
      }
    | undefined;
  /** otherDevicesSignedOut: the reset also ended the sessions on other devices. */
  ResetPasswordSuccess: { otherDevicesSignedOut?: boolean } | undefined;
};

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  TasteQuiz:
    | {
        mode?: "onboarding" | "profile";
        initialPhase?: "taste" | "dietary" | "budget"; // "budget": dietary step, scrolled to the budget
        /** The page the edit was opened from, for the preference events' surface. */
        source?: "settings" | "home";
      }
    | undefined;
  DietaryPreferences:
    | {
        mode?: "onboarding" | "profile";
        initialPhase?: "taste" | "dietary";
      }
    | undefined;
  /** "How open are you to trying new food?" mode "settings": change it from Settings and go back. */
  FoodOpenness: { mode?: "onboarding" | "settings" } | undefined;
  /** Last step: "you're all set", then Home. */
  TasteProfileResult: undefined;
  LocationPermission: undefined;
  /** mode "settings": change the location from Settings and go back, without onboarding. */
  ManualLocationPicker:
    | {
        mode?: "settings" | "onboarding";
        /** Shown inline above the search, e.g. "No problem. Pick your area instead". */
        notice?: string;
      }
    | undefined;
  /** dishName: the dish a guest tapped save on, so the headline can say what the account is for. */
  OnboardingAuth: { dishName?: string } | undefined;
};
export type ProfileStackParamList = {
  ProfileHome: undefined;
  /** Saved: opens on `section` (a deep link to Lists, say); else where the diner left it. */
  Favourites: { section?: "dishes" | "stalls" | "lists" | "posts" } | undefined;
  /** One Lists area: Saved, your lists (portfolios) and checklists. */
  ListsHome: undefined;
  Collections: undefined;
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
  /** `section` scrolls the long form to that part when it opens. */
  BusinessProfileEditor: { section?: "location" | "hours" | "contact" } | undefined;
  DishEditor: { dishId?: string; ocrDraftId?: string } | undefined;
  OCRDrafts: undefined;
  /** `filter` opens a filtered list; `replyToId` opens the reply composer for that review. */
  CustomerInbox: { filter?: "all" | "unreplied"; replyToId?: string } | undefined;
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
  /** "What did you have?" after a stall is marked visited; a system form sheet. */
  StallVisited: {
    venueId: string;
    stallName: string;
    dishes: { id: string; name: string; priceLabel: string }[];
  };
  ReportProblem: {
    venueId: string;
    dishId?: string;
    subjectName?: string;
    /** Picks a reason up front, e.g. "wrong_hours" from the stall page's Add opening hours. */
    initialKind?: "wrong_hours";
  };
  /** `source` names where the dish was opened from, for the dish_viewed event. */
  DishDetail: {
    dishId?: string;
    id?: string;
    source?: DishDetailSource;
    /** What the card already knows: the page paints it at once and starts the stall reads. */
    prefill?: DishPrefill;
    /** Opened from a catalog card: a dish page that can't be found shows the catalog record. */
    catalogFallback?: { releaseId?: string };
  };
  /** Every written review of one dish, paged, with sort and a photo filter. */
  DishReviews: { dishId: string };
  CatalogRawDetail: { kind: "dish" | "venue"; id: string; releaseId?: string };
  SearchHome: undefined;
  SearchResults:
    | {
        browseMode?: "dishes" | "stalls";
        initialQuery?: string;
        foodTypeTag?: string;
        /** Scopes the results to one mall, hawker centre or food court (a catalog building id). */
        placeId?: string;
        placeName?: string;
        /** One chip or several, comma separated: "Halal", "Halal,Rice" or "Under S$6". */
        initialFilter?: string;
        /** Where the search came from; Discover chips already logged their own signal. */
        source?:
          | "discover_chip"
          | "search_typed"
          | "search_recent"
          | "search_suggestion"
          | "search_featured";
      }
    | undefined;
  BrowseDishes: undefined;
  BrowseStalls: undefined;
  DiscoverMap: undefined;
  /** `answers` pre-fills the quiz when "Change answers" reopens it from the result. */
  DecideForMeQuiz: { answers?: DecideAnswers } | undefined;
  DecideForMeResult:
    | { surface?: "home" | "discover" | "push"; answers?: DecideAnswers }
    | undefined;
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
  /** Saved: opens on `section` (a deep link to Lists, say); else where the diner left it. */
  Favourites: { section?: "dishes" | "stalls" | "lists" | "posts" } | undefined;
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
