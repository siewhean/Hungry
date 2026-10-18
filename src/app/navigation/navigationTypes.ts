import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string; completedOnboarding?: boolean } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string; code?: string } | undefined;
  ResetPasswordSuccess: undefined;
};

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingIntro1: undefined;
  CuisineSelection: undefined;
  TasteQuiz: { mode?: "onboarding" | "profile"; initialPhase?: "taste" | "dietary" } | undefined;
  DietaryPreferences:
    | { mode?: "onboarding" | "profile"; initialPhase?: "taste" | "dietary" }
    | undefined;
  TasteProfileResult: undefined;
  LocationPermission: undefined;
  ManualLocationPicker: undefined;
  OnboardingAuth: undefined;
};
export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfilePremium: undefined;
  Favourites: undefined;
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
  DishEditor: { dishId?: string } | undefined;
  OCRDrafts: undefined;
  CustomerInbox: undefined;
  FeaturedVisitors: undefined;
  PromotionBuilder: { promotionId?: string } | undefined;
  PromotionList: undefined;
  AIAssistant: undefined;
  OrdersComingSoon: undefined;
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
  TasteFilter: undefined;
  DiscoverMap: undefined;
  DecideForMeResult: { surface?: "home" | "discover" } | undefined;
  MapZoomedIn: { buildingId: string };
  BlogPost: { postId: string };
  ReviewStack: NavigatorScreenParams<ReviewStackParamList>;
  WheelStack: NavigatorScreenParams<WheelStackParamList>;
  ActivityInbox: { initialTab?: "messages" | "updates" } | undefined;
  ActivityPostDetail: { postId: string; updateId?: string };
  DirectMessages: undefined;
  ChatDetail: { chatId: string; name: string; avatar: string; isOnline?: boolean };
  Crave: undefined;
  MusicSelection: undefined;
  UserProfile: {
    authorName: string;
    authorAvatarUrl?: string;
    authorLocation?: string;
    reviewSignalLabel?: string;
    authorId?: string;
  };
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
  Post: { venueId?: string; dishId?: string } | undefined;
  QuickBites:
    | { collection?: "quickBites" | "trending" | "editorChoice" | "budget" | "lateNight" }
    | undefined;
  DeveloperLauncher: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
  DesignGallery: undefined;
  // V2 Prototypes
  PostComposerV2: { venueId?: string; dishId?: string } | undefined;
  StoryViewer: { initialStoryId: string };
  AddStory: undefined;
  // Gamification
  PassportScreen: undefined;
  MissionsScreen: undefined;
  CollectionList: undefined;
  CollectionDetail: { collectionId: string };
  // Checklist & Portfolio (root-level access)
  ChecklistDetail: { checklistId: string };
  PortfolioDetail: { portfolioId: string };
  PortfolioPublicView: { portfolioId: string };
  AdminPortfolioFlags: undefined;
};
