import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";
import { FoodOpennessScreen } from "./FoodOpennessScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { ManualLocationPickerScreen } from "./ManualLocationPickerScreen";
import { OnboardingAuthScreen } from "./OnboardingAuthScreen";
import { TasteQuizScreen } from "./TasteQuizScreen";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { WelcomeScreen } from "./WelcomeScreen";
export type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Welcome -> Location (GPS or pick an area) -> optional taste quiz -> food openness -> done -> Home.
// Sign-in is not a step: OnboardingAuth opens only when an action needs an account.
export function OnboardingStack() {
  return (
    <Stack.Navigator initialRouteName="OnboardingWelcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingWelcome" component={WelcomeScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="ManualLocationPicker" component={ManualLocationPickerScreen} />
      <Stack.Screen name="TasteQuiz" component={TasteQuizScreen} />
      <Stack.Screen name="DietaryPreferences" component={TasteQuizScreen} />
      <Stack.Screen name="FoodOpenness" component={FoodOpennessScreen} />
      <Stack.Screen name="TasteProfileResult" component={TasteProfileResultScreen} />
      <Stack.Screen name="OnboardingAuth" component={OnboardingAuthScreen} />
    </Stack.Navigator>
  );
}
