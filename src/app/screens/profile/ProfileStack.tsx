import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { EditProfileScreen } from "./EditProfileScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ProfileScreen } from "./ProfileScreen";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Favourites: undefined;
  ReviewHistory: undefined;
  Settings: undefined;
  ReviewFlow: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator initialRouteName="ProfileHome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} />
      <Stack.Screen name="ReviewHistory" component={ReviewHistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ReviewFlow" component={ReviewStack} />
    </Stack.Navigator>
  );
}
