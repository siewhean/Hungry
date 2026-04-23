import Constants from "expo-constants";
import { useState } from "react";
import { Alert, View, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  User,
  Bell,
  HandMetal,
  ShieldCheck,
  Moon,
  Sun,
  Monitor,
  MapPin,
  Trash2,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore, type ThemePreference } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreenV2() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette, spacing, radii } = useHungryTheme();

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

  const ThemeToggle = ({
    type,
    label,
    icon: Icon,
  }: {
    type: ThemePreference;
    label: string;
    icon: any;
  }) => {
    const isSelected = themePreference === type;
    return (
      <Pressable
        onPress={() => setThemePreference(type)}
        style={[
          styles.themeOption,
          {
            backgroundColor: isSelected ? palette.orange : palette.surfaceRaised,
            borderColor: isSelected ? palette.orange : palette.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <Icon size={20} color={isSelected ? palette.white : palette.textSecondary} />
        <AppText
          variant="micro"
          style={{
            color: isSelected ? palette.white : palette.textSecondary,
            marginTop: 4,
            fontWeight: isSelected ? "700" : "500",
          }}
        >
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <ProfileScreenShell title="Settings V2" subtitle="Account and app preferences">
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
        <View style={{ flexDirection: "row", gap: spacing[3], paddingBottom: spacing[4] }}>
          <ThemeToggle type="light" label="Light" icon={Sun} />
          <ThemeToggle type="dark" label="Dark" icon={Moon} />
          <ThemeToggle type="system" label="System" icon={Monitor} />
        </View>
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          label="Help Center"
          onPress={() => void openTrustedExternalUrl("https://hungry.sg/help")}
        />
        <SettingsRow
          label="Privacy Policy"
          onPress={() => void openTrustedExternalUrl("https://hungry.sg/privacy")}
        />
        <SettingsRow
          label="Terms of Service"
          onPress={() => void openTrustedExternalUrl("https://hungry.sg/terms")}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="Version" type="value" value={appVersion} isLast />
      </SettingsSection>

      <View style={{ gap: spacing[3], marginBottom: spacing[20], marginTop: spacing[4] }}>
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => {
            signOut();
            const rootNav = getRootNavigation(navigation);
            rootNav.navigate("AuthStack", { screen: "Login" });
          }}
        />
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

const styles = StyleSheet.create({
  themeOption: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
