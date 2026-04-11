import Constants from "expo-constants";
import { useState } from "react";
import { Alert, Pressable, View, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { 
  ChevronRight, 
  Bell, 
  HandMetal, 
  Leaf, 
  MapPin, 
  ShieldCheck, 
  LogOut, 
  Trash2, 
  Info,
  Smartphone
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Card, Chip, InlineBanner } from "@/components/ui";
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
  const { palette, spacing, radii, shadows } = useHungryTheme();
  
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

  const handleSignOut = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          signOut();
          const rootNavigation = getRootNavigation(navigation);
          rootNavigation.navigate("Splash");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This removes your local data. This action is irreversible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (hungryPersistStorage) {
                await Promise.all([
                  hungryPersistStorage.removeItem("hungry-session-v1"),
                  hungryPersistStorage.removeItem("hungry-profile-v1"),
                  hungryPersistStorage.removeItem("hungry-search-v1"),
                  hungryPersistStorage.removeItem("hungry-review-draft-v1"),
                  hungryPersistStorage.removeItem("hungry-location-v1"),
                ]);
              }
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
    <ProfileScreenShell title="Settings">
      <View style={{ gap: spacing[6], paddingBottom: spacing[8] }}>
        
        {/* Account Section */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" tone="secondary" style={{ paddingHorizontal: spacing[1], textTransform: "uppercase", letterSpacing: 1 }}>Account</AppText>
          <View style={{ gap: spacing[2] }}>
            <SettingRow 
              label="Edit Profile" 
              icon={<ShieldCheck size={20} color={palette.text} />} 
              onPress={() => navigation.navigate("EditProfile")} 
            />
            <SettingRow 
              label="Notification Preferences" 
              icon={<Bell size={20} color={palette.text} />} 
              onPress={() => setNotificationsEnabled(!notificationsEnabled)}
              value={notificationsEnabled ? "Enabled" : "Off"}
            />
          </View>
        </View>

        {/* Experience Section */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" tone="secondary" style={{ paddingHorizontal: spacing[1], textTransform: "uppercase", letterSpacing: 1 }}>Experience</AppText>
          <View style={{ gap: spacing[2] }}>
            <SettingRow 
              label="Left-handed Mode" 
              icon={<HandMetal size={20} color={palette.text} />} 
              onPress={() => setLeftHandedMode(!leftHandedMode)}
              value={leftHandedMode ? "On" : "Off"}
            />
            <SettingRow 
              label="Dietary Filters" 
              icon={<Leaf size={20} color={palette.text} />} 
              onPress={() => setDietaryEnabled(!dietaryEnabled)}
              value={dietaryEnabled ? "Active" : "Off"}
            />
            <SettingRow 
              label="Location Tracking" 
              icon={<MapPin size={20} color={palette.text} />} 
              onPress={() => {}}
              value={location ? "Manual" : "GPS"}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" tone="secondary" style={{ paddingHorizontal: spacing[1], textTransform: "uppercase", letterSpacing: 1 }}>About</AppText>
          <View style={{ gap: spacing[2] }}>
            <SettingRow 
              label="Version" 
              icon={<Smartphone size={20} color={palette.text} />} 
              value={appVersion}
            />
            <SettingRow 
              label="Terms of Service" 
              icon={<Info size={20} color={palette.text} />} 
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
          <Button label="Log out" variant="secondary" leftIcon={<LogOut size={18} color={palette.text} />} onPress={handleSignOut} />
          <Button label="Delete account" variant="destructive" leftIcon={<Trash2 size={18} color="#FFFFFF" />} onPress={handleDeleteAccount} />
        </View>

      </View>
    </ProfileScreenShell>
  );
}

function SettingRow({ label, icon, value, onPress }: { label: string; icon: React.ReactNode; value?: string; onPress?: () => void }) {
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable 
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: 16,
          padding: spacing[4],
          gap: spacing[3],
          borderWidth: 1,
          borderColor: palette.border,
        }
      ]}
    >
      <View style={{ width: 32, alignItems: "center" }}>
        {icon}
      </View>
      <AppText style={{ flex: 1, fontWeight: "600", color: palette.text }}>{label}</AppText>
      {value ? (
        <AppText variant="bodySmall" tone="secondary" style={{ marginRight: spacing[1] }}>{value}</AppText>
      ) : null}
      {onPress && <ChevronRight color={palette.textMuted} size={18} />}
    </Pressable>
  );
}
