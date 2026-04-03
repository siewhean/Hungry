import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { DietaryPreferencesScreen } from "./DietaryPreferencesScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { TasteQuizScreen } from "./TasteQuizScreen";

export type OnboardingStackParamList = {
  TasteQuiz: undefined;
  DietaryPreferences: undefined;
  LocationPermission: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator initialRouteName="TasteQuiz" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasteQuiz" component={TasteQuizScreen} />
      <Stack.Screen name="DietaryPreferences" component={DietaryPreferencesScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
    </Stack.Navigator>
  );
}

