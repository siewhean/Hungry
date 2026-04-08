import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Badge, Button, Card } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { profileSections } from "@/features/profile/profileContent";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { ProfileRadarChart } from "./ProfileRadarChart";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileHome">;

export function ProfileHomeScreen({ navigation }: Props) {
  const profile = useProfileStore((state) => state.profile);
  const signOut = useSessionStore((state) => state.signOut);
  const favourites = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);
  const handleSignOut = () => {
    signOut();
    const rootNavigation = (navigation.getParent?.()?.getParent?.() ?? navigation) as any;
    rootNavigation.navigate("Splash");
  };

  return (
    <ProfileScreenShell title="Profile" subtitle="Taste fingerprint, favourites, and settings in one place.">
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h2">{profile.displayName}</AppText>
          <Badge label={profile.email ? profile.email : "Account required"} tone={profile.email ? "success" : "neutral"} />
          <ProfileRadarChart value={profile.tasteVector} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={`${profile.stats.dishesReviewed} reviews`} tone="info" />
            <Badge label={`${profile.stats.stallsVisited} stalls`} tone="amber" />
            <Badge label={`${profile.stats.favouritesCount} favourites`} tone="orange" />
          </View>
          <Button label="Edit profile" variant="secondary" onPress={() => navigation.navigate("EditProfile")} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Quick access</AppText>
          {profileSections.slice(1).map((section) => (
            <Button
              key={section.key}
              label={section.label}
              variant="secondary"
              onPress={() =>
                navigation.navigate(
                  section.key === "favourites" ? "Favourites" : section.key === "reviews" ? "ReviewHistory" : "Settings",
                )
              }
            />
          ))}
          <Button label="Write a review" onPress={() => navigation.navigate("ReviewFlow")} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">Favourite dishes</AppText>
          {favourites.length ? (
            favourites.slice(0, 2).map((dish) => (
              <View key={dish.id}>
                <AppText variant="body">{dish.name}</AppText>
                <AppText tone="secondary">{dish.priceRange}</AppText>
              </View>
            ))
          ) : (
            <AppText tone="secondary">No favourites yet. Tap the heart when the detail flow is available.</AppText>
          )}
        </View>
      </Card>
      <Button label="Log out" variant="destructive" onPress={handleSignOut} />
    </ProfileScreenShell>
  );
}
