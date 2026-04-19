import Constants from "expo-constants";
import { useState } from "react";
import { Alert, View, ScrollView } from "react-native";
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
  Info,
  ExternalLink,
  ChevronRight,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette, spacing } = useHungryTheme();

  const signOut = useSessionStore((state) => state.signOut);
  const clearSession = useSessionStore((state) => state.clearSession);
  const location = useLocationStore((state) => state.manualLocation);
  const resetLocationState = useLocationStore((state) => state.resetLocationState);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const clearSearchState = useSearchStore((state) => state.clearSearchState);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);

  const themePreference = useUIStore((state) => state.themePreference);
  const setThemePreference = useUIStore((state) => state.setThemePreference);

  const profile = useProfileStore((state) => state.profile);
  const setLeftHandedMode = useProfileStore((state) => state.setLeftHandedMode);

  const [dietaryEnabled, setDietaryEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  const showSupportNotice = (title: string) => {
    Alert.alert(title, "Support and policy pages are not published in this build yet.");
  };

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
              const rootNavigation = getRootNavigation(navigation);
              rootNavigation.navigate("AuthStack", { screen: "SignUp" });
            })();
          },
        },
      ],
    );
  };

  const cycleTheme = () => {
    const next: Record<string, any> = {
      automatic: "light",
      light: "dark",
      dark: "automatic",
    };
    setThemePreference(next[themePreference]);
  };

  return (
    <ProfileScreenShell title="Settings" subtitle="Account and app preferences">
      <SettingsSection title="Account">
        <SettingsRow
          label="Edit Profile"
          icon={<User size={20} color={palette.orange} />}
          onPress={() => navigation.navigate("EditProfile")}
          value={profile.displayName}
        />
        <SettingsRow
          label="Location"
          icon={<MapPin size={20} color={palette.orange} />}
          onPress={() => navigation.navigate("ManualLocationPicker" as any)}
          value={location || "Use GPS"}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="App Preferences">
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
          value={themePreference.charAt(0).toUpperCase() + themePreference.slice(1)}
          onPress={cycleTheme}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow label="Help Center" onPress={() => showSupportNotice("Help Center")} />
        <SettingsRow label="Privacy Policy" onPress={() => showSupportNotice("Privacy Policy")} />
        <SettingsRow
          label="Terms of Service"
          onPress={() => showSupportNotice("Terms of Service")}
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
