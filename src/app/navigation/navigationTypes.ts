import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type OnboardingStackParamList = {
  TasteQuiz: undefined;
  DietaryPreferences: undefined;
  LocationPermission: undefined;
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
  Reads: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  BuildingDrillDown: { buildingId: string };
  DecideForMeResult: undefined;
  SearchResults: undefined;
  TasteFilter: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  DishDetail: { dishId: string };
  StallDetail: { venueId: string };
  BlogPost: { postId: string };
  ReviewStack: NavigatorScreenParams<ReviewStackParamList>;
  Offline: undefined;
  NotFound: { title?: string; body?: string } | undefined;
};
