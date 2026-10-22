import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";

import { EditProfileScreen } from "./EditProfileScreen";
import { AddStallScreen } from "./AddStallScreen";
import { StallSubmissionsScreen } from "./StallSubmissionsScreen";
import { FavouritesScreen } from "./FavouritesScreen";
import { ListsHomeScreen } from "./ListsHomeScreen";
import { ProfileHomeScreen } from "./ProfileHomeScreen";
import { FollowersScreen, FollowingScreen } from "./ProfileConnectionsScreen";
import { ReviewHistoryScreen } from "./ReviewHistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { VisitedStallsScreen } from "./VisitedStallsScreen";
import { FollowedStallsScreen } from "./FollowedStallsScreen";
import { ReviewStack } from "@/app/screens/review/ReviewStack";
import { FeedErrorBoundary } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
export type { ProfileStackParamList };

const Stack = createNativeStackNavigator<ProfileStackParamList>();
const loadChecklistsHomeScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistsHomeScreen") as typeof import("@/app/screens/checklist/ChecklistsHomeScreen")
  ).ChecklistsHomeScreen;
const loadChecklistDetailScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistDetailScreen") as typeof import("@/app/screens/checklist/ChecklistDetailScreen")
  ).ChecklistDetailScreen;
const loadChecklistItemPickerScreen = () =>
  (
    require("@/app/screens/checklist/ChecklistItemPickerScreen") as typeof import("@/app/screens/checklist/ChecklistItemPickerScreen")
  ).ChecklistItemPickerScreen;
const loadPortfoliosHomeScreen = () =>
  (
    require("@/app/screens/portfolio/PortfoliosHomeScreen") as typeof import("@/app/screens/portfolio/PortfoliosHomeScreen")
  ).PortfoliosHomeScreen;
const loadPortfolioDetailScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioDetailScreen") as typeof import("@/app/screens/portfolio/PortfolioDetailScreen")
  ).PortfolioDetailScreen;
const loadPortfolioCreateScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioCreateScreen") as typeof import("@/app/screens/portfolio/PortfolioCreateScreen")
  ).PortfolioCreateScreen;
const loadPortfolioEditScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioEditScreen") as typeof import("@/app/screens/portfolio/PortfolioEditScreen")
  ).PortfolioEditScreen;
const loadPortfolioItemPickerScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioItemPickerScreen") as typeof import("@/app/screens/portfolio/PortfolioItemPickerScreen")
  ).PortfolioItemPickerScreen;
const loadPortfolioCollaboratorsScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioCollaboratorsScreen") as typeof import("@/app/screens/portfolio/PortfolioCollaboratorsScreen")
  ).PortfolioCollaboratorsScreen;
const loadPortfolioSearchScreen = () =>
  (
    require("@/app/screens/portfolio/PortfolioSearchScreen") as typeof import("@/app/screens/portfolio/PortfolioSearchScreen")
  ).PortfolioSearchScreen;
const loadSocialGridScreen = () =>
  (
    require("@/app/screens/profile/SocialGridScreen") as typeof import("@/app/screens/profile/SocialGridScreen")
  ).SocialGridScreen;
const loadSocialPostDetailScreen = () =>
  (
    require("@/app/screens/profile/SocialPostDetailScreen") as typeof import("@/app/screens/profile/SocialPostDetailScreen")
  ).SocialPostDetailScreen;

export function ProfileStack() {
  return (
    <FeedErrorBoundary
      title="Profile unavailable"
      body="We hit a snag loading your profile. Your taste data is safe—please try again."
    >
      <Stack.Navigator initialRouteName="ProfileHome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="AddStall" component={AddStallScreen} />
        <Stack.Screen name="StallSubmissions" component={StallSubmissionsScreen} />
        <Stack.Screen name="Followers" component={FollowersScreen} />
        <Stack.Screen name="Following" component={FollowingScreen} />
        <Stack.Screen name="VisitedStalls" component={VisitedStallsScreen} />
        <Stack.Screen name="FollowedStalls" component={FollowedStallsScreen} />
        <Stack.Screen name="Favourites" component={FavouritesScreen} />
        <Stack.Screen name="ListsHome" component={ListsHomeScreen} />
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
          </>
        ) : null}
        {FEATURE_FLAGS.portfoliosEnabled ? (
          <>
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
