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
    </Stack.Navigator>
  );
}
