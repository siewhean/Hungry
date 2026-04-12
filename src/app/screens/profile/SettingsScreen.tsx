import Constants from "expo-constants";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Badge, Button, Card, Chip, InlineBanner } from "@/components/ui";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { spacing } = useHungryTheme();
  const signOut = useSessionStore((state) => state.signOut);
  const clearSession = useSessionStore((state) => state.clearSession);
  const location = useLocationStore((state) => state.manualLocation);
  const resetLocationState = useLocationStore((state) => state.resetLocationState);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const clearSearchState = useSearchStore((state) => state.clearSearchState);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const leftHandedMode = useProfileStore((state) => state.profile.leftHandedMode ?? false);
  const setLeftHandedMode = useProfileStore((state) => state.setLeftHandedMode);
  const [dietaryEnabled, setDietaryEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  const purgePersistedAccountData = async () => {
    if (!hungryPersistStorage) {
      return;
    }

    await Promise.all([
      hungryPersistStorage.removeItem("hungry-session-v1"),
      hungryPersistStorage.removeItem("hungry-profile-v1"),
      hungryPersistStorage.removeItem("hungry-search-v1"),
      hungryPersistStorage.removeItem("hungry-review-draft-v1"),
      hungryPersistStorage.removeItem("hungry-location-v1"),
    ]);
  };

  const handleSignOut = () => {
    signOut();
    const rootNavigation = getRootNavigation(navigation);
    rootNavigation.navigate("Splash");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This removes your local session and profile data on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await purgePersistedAccountData();
              clearSession();
              clearProfile();
              clearSearchState();
              resetDraft();
              resetLocationState();
              const rootNavigation = getRootNavigation(navigation);
              rootNavigation.navigate("AuthStack", { screen: "SignUp" });
            })();
          },
        },
      ],
    );
  };

  return (
    <ProfileScreenShell title="Settings" subtitle="Account, privacy, and lightweight preferences.">
      <Card>
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">Preferences</AppText>
          <View style={{ flexDirection: "row", gap: spacing[2], flexWrap: "wrap" }}>
            <Chip
              label="Dietary filters"
              selected={dietaryEnabled}
              onPress={() => setDietaryEnabled((value) => !value)}
            />
            <Chip
              label="Notifications"
              selected={notificationsEnabled}
              onPress={() => setNotificationsEnabled((value) => !value)}
            />
            <Chip
              label="Left-handed mode"
              selected={leftHandedMode}
              onPress={() => setLeftHandedMode(!leftHandedMode)}
            />
          </View>
          <Badge label={location ? `Manual location: ${location}` : "Location uses GPS"} tone="neutral" />
        </View>
      </Card>
      <Button label="Log out" variant="secondary" onPress={handleSignOut} />
      <Button label="Delete account" variant="destructive" onPress={handleDeleteAccount} />
      <View style={{ marginTop: spacing[4], alignItems: "center", opacity: 0.5 }}>
        <AppText variant="micro">Hungry v{appVersion} {"\u00B7"} Singapore</AppText>
      </View>
    </ProfileScreenShell>
  );
}
