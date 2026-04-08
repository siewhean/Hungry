import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";
import { DietaryPreferencesScreen } from "./DietaryPreferencesScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { OnboardingIntro1Screen } from "./OnboardingIntro1Screen";
import { OnboardingIntro2Screen } from "./OnboardingIntro2Screen";
import { OnboardingIntro3Screen } from "./OnboardingIntro3Screen";
import { TasteQuizScreen } from "./TasteQuizScreen";
export type { OnboardingStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator initialRouteName="OnboardingIntro1" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingIntro1" component={OnboardingIntro1Screen} />
      <Stack.Screen name="OnboardingIntro2" component={OnboardingIntro2Screen} />
      <Stack.Screen name="OnboardingIntro3" component={OnboardingIntro3Screen} />
      <Stack.Screen name="TasteQuiz" component={TasteQuizScreen} />
      <Stack.Screen name="DietaryPreferences" component={DietaryPreferencesScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
    </Stack.Navigator>
  );
}
