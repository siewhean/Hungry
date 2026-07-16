import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";

import { EditProfileScreen } from "./EditProfileScreen";
import { AddStallScreen } from "./AddStallScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ProfileHomeScreen } from "./ProfileHomeScreen";
import { FollowersScreen, FollowingScreen } from "./ProfileConnectionsScreen";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { VisitedStallsScreen } from "./VisitedStallsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { FeedErrorBoundary } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  loadChecklistDetailScreen,
  loadChecklistItemPickerScreen,
  loadChecklistsHomeScreen,
  loadPortfolioCollaboratorsScreen,
  loadPortfolioCreateScreen,
  loadPortfolioDetailScreen,
  loadPortfolioEditScreen,
  loadPortfolioItemPickerScreen,
  loadPortfolioSearchScreen,
  loadPortfoliosHomeScreen,
  loadSocialGridScreen,
  loadSocialPostDetailScreen,
} from "@/app/screens/profile/optionalProfileRouteLoaders";
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
        <Stack.Screen name="AddStall" component={AddStallScreen} />
        <Stack.Screen name="Followers" component={FollowersScreen} />
        <Stack.Screen name="Following" component={FollowingScreen} />
        <Stack.Screen name="VisitedStalls" component={VisitedStallsScreen} />
        <Stack.Screen name="Favourites" component={FavouritesScreen} />
        <Stack.Screen name="ReviewHistory" component={ReviewHistoryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ReviewFlow" component={ReviewStack} />
        {FEATURE_FLAGS.collectionsEnabled ? (
          <>
            <Stack.Screen name="SocialGrid" getComponent={loadSocialGridScreen} />
            <Stack.Screen name="SocialPostDetail" getComponent={loadSocialPostDetailScreen} />
            <Stack.Screen name="ChecklistsHome" getComponent={loadChecklistsHomeScreen} />
            <Stack.Screen name="ChecklistDetail" getComponent={loadChecklistDetailScreen} />
            <Stack.Screen name="ChecklistItemPicker" getComponent={loadChecklistItemPickerScreen} />
            <Stack.Screen name="PortfoliosHome" getComponent={loadPortfoliosHomeScreen} />
            <Stack.Screen name="PortfolioDetail" getComponent={loadPortfolioDetailScreen} />
            <Stack.Screen name="PortfolioCreate" getComponent={loadPortfolioCreateScreen} />
            <Stack.Screen name="PortfolioEdit" getComponent={loadPortfolioEditScreen} />
            <Stack.Screen name="PortfolioItemPicker" getComponent={loadPortfolioItemPickerScreen} />
            <Stack.Screen
              name="PortfolioCollaborators"
              getComponent={loadPortfolioCollaboratorsScreen}
            />
            <Stack.Screen name="PortfolioSearch" getComponent={loadPortfolioSearchScreen} />
          </>
        ) : null}
      </Stack.Navigator>
    </FeedErrorBoundary>
  );
}
