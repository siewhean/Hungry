import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";

import { EditProfileScreen } from "./EditProfileScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ProfileHomeScreen } from "./ProfileHomeScreen";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { FeedErrorBoundary } from "@/components/ui";
export type { ProfileStackParamList };

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <FeedErrorBoundary
      title="Profile unavailable"
      body="We hit a snag loading your profile. Your taste data is safe—please try again."
    >
      <Stack.Navigator initialRouteName="ProfileHome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
        <Stack.Screen name="ProfilePremium" component={ProfileHomeScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Favourites" component={FavouritesScreen} />
        <Stack.Screen name="ReviewHistory" component={ReviewHistoryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ReviewFlow" component={ReviewStack} />
      </Stack.Navigator>
    </FeedErrorBoundary>
  );
}
