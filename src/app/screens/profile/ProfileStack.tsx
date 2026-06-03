import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";

import { EditProfileScreen } from "./EditProfileScreen";
import { AddStallScreen } from "./AddStallScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ProfileHomeScreen } from "./ProfileHomeScreen";
import { FollowersScreen, FollowingScreen } from "./ProfileConnectionsScreen";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { SocialPostDetailScreen } from "./SocialPostDetailScreen";
import { SocialGridScreen } from "./SocialGridScreen";
import { VisitedStallsScreen } from "./VisitedStallsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { FeedErrorBoundary } from "@/components/ui";
import { ChecklistsHomeScreen } from "@/app/screens/checklist/ChecklistsHomeScreen";
import { ChecklistDetailScreen } from "@/app/screens/checklist/ChecklistDetailScreen";
import { ChecklistItemPickerScreen } from "@/app/screens/checklist/ChecklistItemPickerScreen";
import { PortfoliosHomeScreen } from "@/app/screens/portfolio/PortfoliosHomeScreen";
import { PortfolioDetailScreen } from "@/app/screens/portfolio/PortfolioDetailScreen";
import { PortfolioCreateScreen } from "@/app/screens/portfolio/PortfolioCreateScreen";
import { PortfolioEditScreen } from "@/app/screens/portfolio/PortfolioEditScreen";
import { PortfolioItemPickerScreen } from "@/app/screens/portfolio/PortfolioItemPickerScreen";
import { PortfolioCollaboratorsScreen } from "@/app/screens/portfolio/PortfolioCollaboratorsScreen";
import { PortfolioSearchScreen } from "@/app/screens/portfolio/PortfolioSearchScreen";
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
        <Stack.Screen name="SocialGrid" component={SocialGridScreen} />
        <Stack.Screen name="SocialPostDetail" component={SocialPostDetailScreen} />
        <Stack.Screen name="ReviewFlow" component={ReviewStack} />
        <Stack.Screen name="ChecklistsHome" component={ChecklistsHomeScreen} />
        <Stack.Screen name="ChecklistDetail" component={ChecklistDetailScreen} />
        <Stack.Screen name="ChecklistItemPicker" component={ChecklistItemPickerScreen} />
        <Stack.Screen name="PortfoliosHome" component={PortfoliosHomeScreen} />
        <Stack.Screen name="PortfolioDetail" component={PortfolioDetailScreen} />
        <Stack.Screen name="PortfolioCreate" component={PortfolioCreateScreen} />
        <Stack.Screen name="PortfolioEdit" component={PortfolioEditScreen} />
        <Stack.Screen name="PortfolioItemPicker" component={PortfolioItemPickerScreen} />
        <Stack.Screen name="PortfolioCollaborators" component={PortfolioCollaboratorsScreen} />
        <Stack.Screen name="PortfolioSearch" component={PortfolioSearchScreen} />
      </Stack.Navigator>
    </FeedErrorBoundary>
  );
}
