import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
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

export type ReviewStackParamList = {
  ReviewHub: undefined;
  ReviewRating: { venueId?: string; dishId?: string } | undefined;
  ReviewTags: undefined;
  ReviewCompose: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Maps: undefined;
  Review: undefined;
  Profile: undefined;
};
export type WheelStackParamList = {
  WheelHome: { code?: string } | undefined;
  WheelLobby: { partyId: string };
  WheelSpin: { partyId: string };
  WheelResult: { partyId: string; winnerEntryId: string };
};

export type RootStackParamList = {
  DeveloperLauncher: undefined;
  Splash: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ReadsFeed: undefined;
  SearchHome: undefined;
  SearchResults: undefined;
  TasteFilter: undefined;
  MapZoomedIn: { buildingId?: string } | undefined;
  Post: { venueId?: string; dishId?: string } | undefined;
  EditProfile: undefined;
  BuildingDrillDown: { buildingId: string };
  DecideForMeResult: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  DishDetail: { dishId: string };
  StallDetail: { venueId: string };
  BlogPost: { postId: string };
  ReviewStack: NavigatorScreenParams<ReviewStackParamList>;
  WheelStack: NavigatorScreenParams<WheelStackParamList>;
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
};
