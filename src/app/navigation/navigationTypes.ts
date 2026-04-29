import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string; code: string } | undefined;
  ResetPasswordSuccess: undefined;
};

export type OnboardingStackParamList = {
  OnboardingIntro1: undefined;
  OnboardingIntro2: undefined;
  OnboardingIntro3: undefined;
  CuisineSelection: undefined;
  FoodSelection: { cuisines: string[] };
  TasteQuiz: { mode?: "onboarding" | "profile" } | undefined;
  DietaryPreferences: undefined;
  TasteProfileLoading: undefined;
  TasteProfileResult: undefined;
  LocationPermission: undefined;
  ManualLocationPicker: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfilePremium: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ReviewFlow: undefined;
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
  Rate: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type MerchantTabParamList = {
  Dashboard: undefined;
  Menu: undefined;
  Analytics: undefined;
  Profile: undefined;
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
  SearchHome: undefined;
  SearchResults: undefined;
  TasteFilter: undefined;
  DiscoverMap: undefined;
  DecideForMeResult: undefined;
  BuildingDrillDown: { buildingId: string };
  MapZoomedIn: { buildingId: string };
  BlogPost: { postId: string };
  ReviewStack: NavigatorScreenParams<ReviewStackParamList>;
  WheelStack: NavigatorScreenParams<WheelStackParamList>;
  DirectMessages: undefined;
  ChatDetail: { chatId: string; name: string; avatar: string };
  Crave: undefined;
  MusicSelection: undefined;
  DishDetailStandard: { dishId: string };
  UserProfile: {
    authorName: string;
    authorAvatarUrl?: string;
    authorLocation?: string;
  };
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
  Post: { venueId?: string; dishId?: string } | undefined;
  QuickBites: undefined;
  DeveloperLauncher: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
  SplashV2: { variant?: "A" | "B"; stay?: boolean } | undefined;
  DesignGallery: undefined;
  // V2 Prototypes
  ReviewFeedV2: undefined;
  PostComposerV2: { venueId?: string; dishId?: string } | undefined;
  DiscoverV2: undefined;
  SearchHomeV2: undefined;
  StallDetailV2: { venueId?: string; id?: string };
  BuildingDrillDownV2: { buildingId: string };
  QuickReviewV2: { venueId?: string; dishId?: string } | undefined;
  VenueDirectory: { venueId: string };
};
