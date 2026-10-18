import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";
import { CuisineSelectionScreen } from "./CuisineSelectionScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { ManualLocationPickerScreen } from "./ManualLocationPickerScreen";
import { OnboardingAuthScreen } from "./OnboardingAuthScreen";
import { OnboardingIntro1Screen } from "./OnboardingIntro1Screen";
import { TasteQuizScreen } from "./TasteQuizScreen";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { WelcomeScreen } from "./WelcomeScreen";
export type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator initialRouteName="OnboardingWelcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingWelcome" component={WelcomeScreen} />
      <Stack.Screen name="OnboardingIntro1" component={OnboardingIntro1Screen} />
      <Stack.Screen name="CuisineSelection" component={CuisineSelectionScreen} />
      <Stack.Screen name="TasteQuiz" component={TasteQuizScreen} />
      <Stack.Screen name="DietaryPreferences" component={TasteQuizScreen} />
      <Stack.Screen name="TasteProfileResult" component={TasteProfileResultScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="ManualLocationPicker" component={ManualLocationPickerScreen} />
      <Stack.Screen name="OnboardingAuth" component={OnboardingAuthScreen} />
    </Stack.Navigator>
  );
}
