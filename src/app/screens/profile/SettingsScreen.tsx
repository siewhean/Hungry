import Constants from "expo-constants";
import { useState } from "react";
import { Alert, View, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  User,
  Bell,
  HandMetal,
  ShieldCheck,
  Moon,
  MapPin,
  Trash2,
  Globe,
  Lock,
  Star,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ThemePreference, useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const rootNavigation = getRootNavigation(navigation);
  const { palette, spacing } = useHungryTheme();

  const clearSession = useSessionStore((state) => state.clearSession);
  const location = useLocationStore((state) => state.manualLocation);
  const resetLocationState = useLocationStore((state) => state.resetLocationState);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const clearSearchState = useSearchStore((state) => state.clearSearchState);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const setProfileVisibility = useProfileStore((state) => state.setProfileVisibility);

  const themePreference = useUIStore((state) => state.themePreference);
  const setThemePreference = useUIStore((state) => state.setThemePreference);

  const profile = useProfileStore((state) => state.profile);
  const setLeftHandedMode = useProfileStore((state) => state.setLeftHandedMode);
  const isProfilePrivate = profile.profileVisibility === "private";

  const [dietaryEnabled, setDietaryEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Gamification privacy
  const [showCredTier, setShowCredTier] = useState(true);
  const [showPassport, setShowPassport] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [missionNotifications, setMissionNotifications] = useState(true);

  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const normalizedThemePreference: ThemePreference =
    themePreference === "system" || themePreference === "light" || themePreference === "dark"
      ? themePreference
      : "system";

  const purgePersistedAccountData = async () => {
    if (!hungryPersistStorage) return;
    await Promise.all([
      hungryPersistStorage.removeItem("hungry-session-v1"),
      hungryPersistStorage.removeItem("hungry-profile-v1"),
      hungryPersistStorage.removeItem("hungry-search-v1"),
      hungryPersistStorage.removeItem("hungry-review-draft-v1"),
      hungryPersistStorage.removeItem("hungry-location-v1"),
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This removes your local session and profile data. This action is permanent.",
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
              rootNavigation.navigate("AuthStack", { screen: "SignUp" });
            })();
          },
        },
      ],
    );
  };

  const cycleTheme = () => {
    const cycle: ThemePreference[] = ["system", "light", "dark"];
    const currentIndex = cycle.indexOf(normalizedThemePreference);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setThemePreference(cycle[nextIndex] ?? "system");
  };

  const showProfileVisibilityDialog = () => {
    Alert.alert("Profile visibility", "Choose who can see your Hungry profile.", [
      {
        text: "Public",
        onPress: () => setProfileVisibility("public"),
      },
      {
        text: "Private",
        onPress: () => setProfileVisibility("private"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  return (
    <ProfileScreenShell title="Settings">
      <SettingsSection>
        <SettingsRow
          label="Edit Profile"
          icon={<User size={20} color={palette.orange} />}
          onPress={() => navigation.navigate("EditProfile")}
          value={profile.displayName}
        />
        <SettingsRow
          label="Location"
          icon={<MapPin size={20} color={palette.orange} />}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", { screen: "ManualLocationPicker" })
          }
          value={location || "Use GPS"}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Privacy">
        <SettingsRow
          label="Profile visibility"
          icon={
            isProfilePrivate ? (
              <Lock size={20} color={palette.orange} />
            ) : (
              <Globe size={20} color={palette.orange} />
            )
          }
          type="navigation"
          value={isProfilePrivate ? "Private" : "Public"}
          onPress={showProfileVisibilityDialog}
          isLast
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Left-handed mode"
          icon={<HandMetal size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={profile.leftHandedMode}
          onToggle={setLeftHandedMode}
        />
        <SettingsRow
          label="Dietary filters"
          icon={<ShieldCheck size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={dietaryEnabled}
          onToggle={setDietaryEnabled}
        />
        <SettingsRow
          label="Push Notifications"
          icon={<Bell size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={notificationsEnabled}
          onToggle={setNotificationsEnabled}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsRow
          label="Theme"
          icon={<Moon size={20} color={palette.orange} />}
          type="navigation"
          value={
            normalizedThemePreference === "system"
              ? "Automatic"
              : normalizedThemePreference.charAt(0).toUpperCase() +
                normalizedThemePreference.slice(1)
          }
          onPress={cycleTheme}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Gamification">
        <SettingsRow
          label="Show Food Cred tier on profile"
          icon={<Star size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={showCredTier}
          onToggle={setShowCredTier}
        />
        <SettingsRow
          label="Show Passport progress"
          icon={<Globe size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={showPassport}
          onToggle={setShowPassport}
        />
        <SettingsRow
          label="Show badges on profile"
          icon={<ShieldCheck size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={showBadges}
          onToggle={setShowBadges}
        />
        <SettingsRow
          label="Mission notifications"
          icon={<Bell size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={missionNotifications}
          onToggle={setMissionNotifications}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          label="Help Center"
          onPress={() => Linking.openURL("https://hungry.sg/help")}
        />
        <SettingsRow
          label="Privacy Policy"
          onPress={() => Linking.openURL("https://hungry.sg/privacy")}
        />
        <SettingsRow
          label="Terms of Service"
          onPress={() => Linking.openURL("https://hungry.sg/terms")}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="Version" type="value" value={appVersion} isLast />
      </SettingsSection>

      <View style={{ gap: spacing[3], marginBottom: spacing[12] }}>
        <Button
          label="Delete account"
          variant="destructive"
          onPress={handleDeleteAccount}
          leftIcon={<Trash2 size={20} color={palette.white} />}
        />
      </View>
    </ProfileScreenShell>
  );
}
