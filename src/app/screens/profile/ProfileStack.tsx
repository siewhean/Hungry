import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
export type { ProfileStackParamList };

import { EditProfileScreen } from "./EditProfileScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ProfileHomeScreen } from "./ProfileHomeScreen";
import { ProfileHomeScreen_Legacy } from "./ProfileHomeScreen_Legacy";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator initialRouteName="ProfileHome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen_Legacy} />
      {/* @ts-ignore */}
      <Stack.Screen name="ProfilePremium" component={ProfileHomeScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} />
      <Stack.Screen name="ReviewHistory" component={ReviewHistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ReviewFlow" component={ReviewStack} />
    </Stack.Navigator>
  );
}
