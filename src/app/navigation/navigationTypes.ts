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
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
};

export type ReviewStackParamList = {
  ReviewHub: { venueId?: string; dishId?: string } | undefined;
  ReviewRating: { venueId: string; dishId?: string };
  ReviewTags: { venueId: string; dishId?: string };
  ReviewCompose: { venueId: string; dishId?: string };
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

export type RootStackParamList = {
  Splash: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  StallDetail: { venueId: string };
  DishDetail: { dishId: string };
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
  Crave: undefined;
  UserProfile: {
    authorName: string;
    authorAvatarUrl?: string;
    authorLocation?: string;
  };
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
  Post: { venueId?: string; dishId?: string } | undefined;
  DeveloperLauncher: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  EditProfile: undefined;
};
