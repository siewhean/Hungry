import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";
import { FoodOpennessScreen } from "./FoodOpennessScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { ManualLocationPickerScreen } from "./ManualLocationPickerScreen";
import {
  ONBOARDING_RESUME_ROUTES,
  useOnboardingDraftStore,
  type OnboardingResumeRoute,
} from "@/store/useOnboardingDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { MandatoryOnboardingAuthScreen } from "./MandatoryOnboardingAuthScreen";
import { TasteQuizRoute } from "./TasteQuizRoute";
import { TasteQuizScreen } from "./TasteQuizScreen";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { OnboardingAreasScreen } from "./OnboardingAreasScreen";
import { OnboardingDishGridScreen } from "./OnboardingDishGridScreen";
import { OnboardingLoadingScreen } from "./OnboardingLoadingScreen";
import { OnboardingMealPicksScreen } from "./OnboardingMealPicksScreen";
import { OnboardingMealTimesScreen } from "./OnboardingMealTimesScreen";
import { OnboardingNameScreen } from "./OnboardingNameScreen";
import { OnboardingPalateIntroScreen } from "./OnboardingPalateIntroScreen";
import { OnboardingPalateRevealScreen } from "./OnboardingPalateRevealScreen";
import { OnboardingPriceScreen } from "./OnboardingPriceScreen";
import { OnboardingResultsScreen } from "./OnboardingResultsScreen";
import { OnboardingSwipeScreen } from "./OnboardingSwipeScreen";
import { WelcomeScreen } from "./WelcomeScreen";
export type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Every focus on a resumable step is remembered, so a relaunch reopens the step the user was on.
// Welcome starts a new run, so it forgets the old one.
const focusListeners = ({ route }: { route: { name: string } }) => ({
  focus: () => {
    const draft = useOnboardingDraftStore.getState();
    if (route.name === "OnboardingWelcome") {
      draft.clearDraft();
      useSessionStore.getState().setReturningAccountIntent(false);
      return;
    }
    if ((ONBOARDING_RESUME_ROUTES as readonly string[]).includes(route.name)) {
      draft.rememberRoute(route.name as OnboardingResumeRoute);
    }
  },
});

// Welcome -> Location (GPS or pick an area) -> optional taste quiz -> food openness -> done -> Home.
// Sign-in is required: a signed-out user finishes on the OnboardingAuth account step.
export function OnboardingStack() {
  return (
    <Stack.Navigator
      initialRouteName="OnboardingWelcome"
      screenOptions={{ headerShown: false }}
      screenListeners={focusListeners}
    >
      <Stack.Screen name="OnboardingWelcome" component={WelcomeScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="ManualLocationPicker" component={ManualLocationPickerScreen} />
      <Stack.Screen name="TasteQuiz" component={TasteQuizRoute} />
      <Stack.Screen name="DietaryPreferences" component={TasteQuizScreen} />
      <Stack.Screen name="FoodOpenness" component={FoodOpennessScreen} />
      <Stack.Screen name="TasteProfileResult" component={TasteProfileResultScreen} />
      <Stack.Screen name="OnboardingAuth" component={MandatoryOnboardingAuthScreen} />
      {/* The slider-flow screens (sliderOnboardingEnabled); nothing navigates here with the flag off. */}
      <Stack.Screen name="OnboardingName" component={OnboardingNameScreen} />
      <Stack.Screen name="OnboardingAreas" component={OnboardingAreasScreen} />
      <Stack.Screen name="OnboardingMealTimes" component={OnboardingMealTimesScreen} />
      <Stack.Screen name="OnboardingPalateIntro" component={OnboardingPalateIntroScreen} />
      <Stack.Screen name="OnboardingPalateReveal" component={OnboardingPalateRevealScreen} />
      <Stack.Screen name="OnboardingDishGrid" component={OnboardingDishGridScreen} />
      <Stack.Screen name="OnboardingPrice" component={OnboardingPriceScreen} />
      <Stack.Screen name="OnboardingSwipe" component={OnboardingSwipeScreen} />
      <Stack.Screen name="OnboardingLoading" component={OnboardingLoadingScreen} />
      <Stack.Screen name="OnboardingResults" component={OnboardingResultsScreen} />
      <Stack.Screen name="OnboardingMealPicks" component={OnboardingMealPicksScreen} />
    </Stack.Navigator>
  );
}
