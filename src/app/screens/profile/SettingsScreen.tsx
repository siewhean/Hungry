import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Share, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AtSign,
  CircleHelp,
  Database,
  Download,
  HandMetal,
  Globe,
  Lock,
  LogOut,
  MapPin,
  Moon,
  RefreshCw,
  Shield,
  Smartphone,
  User,
  Trash2,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/services/types";
import { clearImageCache } from "@/features/navigation/prefetch";
import { buildMyDataExport } from "@/features/profile/exportMyData";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ThemePreference, useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { SUPPORT_EMAIL, WEB_LINKS } from "@/constants/links";

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const rootNavigation = getRootNavigation(navigation);
  const { palette, spacing } = useHungryTheme();

  const clearSession = useSessionStore((state) => state.clearSession);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const clearSearchState = useSearchStore((state) => state.clearSearchState);
  const clearSearchHistory = useSearchStore((state) => state.clearSearchHistory);
  const resetLocationState = useLocationStore((state) => state.resetLocationState);
  const signOut = useSessionStore((state) => state.signOut);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const syncLocationPermission = useLocationStore((state) => state.syncLocationPermission);
  const setProfileVisibility = useProfileStore((state) => state.setProfileVisibility);
  const setLeftHandedMode = useProfileStore((state) => state.setLeftHandedMode);

  const themePreference = useUIStore((state) => state.themePreference);
  const setThemePreference = useUIStore((state) => state.setThemePreference);
  const hapticFeedbackEnabled = useUIStore((state) => state.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useUIStore((state) => state.setHapticFeedbackEnabled);
  const reducedMotionEnabled = useUIStore((state) => state.reducedMotionEnabled);
  const setReducedMotionEnabled = useUIStore((state) => state.setReducedMotionEnabled);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const setAllowSearchHistory = useUIStore((state) => state.setAllowSearchHistory);

  const profile = useProfileStore((state) => state.profile);
  const location = useLocationStore((state) => state.manualLocation);
  const locationPermission = useLocationStore((state) => state.permission);
  const isProfilePrivate = profile.profileVisibility === "private";

  const normalizedThemePreference: ThemePreference =
    themePreference === "system" || themePreference === "light" || themePreference === "dark"
      ? themePreference
      : "system";

  const [deletionRequested, setDeletionRequested] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  // The OS permission can change in system Settings; re-read it whenever the app comes back.
  useEffect(() => {
    void syncLocationPermission();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void syncLocationPermission();
    });
    return () => subscription.remove();
  }, [syncLocationPermission]);

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

  const handleExportData = () => {
    void (async () => {
      setIsExportingData(true);
      try {
        const exportData = await buildMyDataExport(getHungryService());
        await Share.share({
          title: "My Hungry data",
          message: JSON.stringify(exportData, null, 2),
        });
      } catch {
        Alert.alert(
          "Export failed",
          `We could not prepare your data right now. Please try again or email ${SUPPORT_EMAIL}.`,
        );
      } finally {
        setIsExportingData(false);
      }
    })();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      `Your account and personal data will be deleted in ${ACCOUNT_DELETION_GRACE_DAYS} days. Sign back in before then to keep your account. After that, deletion is permanent. Menu photos you shared stay on the stall without your name, and some security, moderation, or legal records may remain in anonymized form.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request deletion",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeletionRequested(true);
                await getHungryService().auth.requestAccountDeletion({
                  reason: "user_initiated_settings_flow",
                });
                await purgePersistedAccountData();
                clearSession();
                clearProfile();
                clearSearchState();
                resetDraft();
                resetLocationState();
                rootNavigation.navigate("AuthStack", { screen: "SignUp" });
              } catch {
                setDeletionRequested(false);
                Alert.alert(
                  "Deletion request failed",
                  "We could not queue your account deletion request. Please try again or contact support.",
                );
              }
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

  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Open settings",
        "Unable to open system settings from here. You can update permissions from your device settings app.",
      );
    }
  };

  // Shows the OS permission; only the system can revoke it, so the row asks or opens Settings.
  const handleLocationPermissionPress = async () => {
    if (locationPermission !== "unknown") {
      void openAppSettings();
      return;
    }
    const granted = await grantLocation({ manualLocation: location });
    if (!granted) {
      Alert.alert(
        "Location permissions",
        "Hungry could not enable location access. Update this permission in Settings if you previously denied it.",
        [
          { text: "Open Settings", onPress: () => void openAppSettings() },
          { text: "Cancel", style: "cancel" },
        ],
      );
    }
  };

  const handleSearchHistoryToggle = (enabled: boolean) => {
    setAllowSearchHistory(enabled);
    if (!enabled) {
      clearSearchHistory();
    }
  };

  const handleResetLocation = () => {
    Alert.alert(
      "Reset selected location",
      "This clears the area you picked. Hungry will use your device location when location access is allowed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: () => {
            void clearManualLocation().then(() =>
              Alert.alert("Location reset", "Your selected location has been cleared."),
            );
          },
        },
      ],
    );
  };

  const handleClearLocalData = () => {
    Alert.alert(
      "Clear local cache",
      "This removes recent searches, unsent review drafts and cached images on this device. You stay signed in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: () => {
            void (async () => {
              // Only caches: the session, profile and location stay so nothing is signed out.
              await Promise.all([
                hungryPersistStorage?.removeItem("hungry-search-v1"),
                hungryPersistStorage?.removeItem("hungry-review-draft-v1"),
                clearImageCache(),
              ]);
              resetDraft();
              clearSearchState();
              clearSearchHistory();
              Alert.alert(
                "Local cache cleared",
                "Recent searches, drafts and cached images were removed from this device.",
              );
            })();
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "You will be signed out from Hungry on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          signOut();
          clearSearchState();
          resetDraft();
          rootNavigation.reset({
            index: 0,
            routes: [{ name: "AuthStack", params: { screen: "Login" } }],
          });
        },
      },
    ]);
  };

  return (
    <ProfileScreenShell title="Settings">
      <SettingsSection title="Account">
        <SettingsRow
          label="Edit Profile"
          icon={<User size={20} color={palette.orange} />}
          onPress={() => navigation.navigate("EditProfile")}
          value={profile.displayName}
          isLast={false}
        />
        <SettingsRow
          label="Display name"
          icon={<User size={20} color={palette.orange} />}
          type="value"
          value={profile.displayName}
          isLast={false}
        />
        <SettingsRow
          label="Email"
          icon={<AtSign size={20} color={palette.orange} />}
          type="value"
          value={profile.email?.trim() || "Not linked"}
          isLast={false}
        />
        <SettingsRow
          label="Profile ID"
          icon={<CircleHelp size={20} color={palette.orange} />}
          type="value"
          value={profile.id}
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

      <SettingsSection title="Location & Discovery">
        <SettingsRow
          label="Location"
          icon={<MapPin size={20} color={palette.orange} />}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "ManualLocationPicker",
              params: { mode: "settings" },
            })
          }
          value={location || "Use GPS"}
          isLast={false}
        />
        <SettingsRow
          label="Location permission"
          icon={<MapPin size={20} color={palette.orange} />}
          type="navigation"
          value={
            locationPermission === "granted"
              ? "Allowed"
              : locationPermission === "denied"
                ? "Not allowed"
                : "Not asked yet"
          }
          description={
            locationPermission === "unknown"
              ? "Tap to allow location access"
              : "Change this in your device settings"
          }
          onPress={() => void handleLocationPermissionPress()}
          isLast={false}
        />
        <SettingsRow
          label="Reset selected location"
          icon={<RefreshCw size={20} color={palette.orange} />}
          onPress={handleResetLocation}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Feed and discovery settings">
        <SettingsRow
          label="Left-handed mode"
          icon={<HandMetal size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={profile.leftHandedMode}
          onToggle={setLeftHandedMode}
          isLast
        />
      </SettingsSection>

      {FEATURE_FLAGS.stallAlertsEnabled && isAuthenticated ? (
        <StallAlertsSettings
          onOpenFollowedStalls={() =>
            // Settings is also a root route, where FollowedStalls is not a sibling.
            rootNavigation.navigate("MainTabs", {
              screen: "Profile",
              params: { screen: "FollowedStalls" },
            })
          }
        />
      ) : null}

      <SettingsSection title="App settings">
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
          isLast={false}
        />
        <SettingsRow
          label="Reduce motion"
          icon={<Smartphone size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={reducedMotionEnabled}
          onToggle={setReducedMotionEnabled}
          isLast={false}
        />
        <SettingsRow
          label="Haptic feedback"
          icon={<HandMetal size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={hapticFeedbackEnabled}
          onToggle={setHapticFeedbackEnabled}
          isLast={false}
        />
        <SettingsRow
          label="Open app settings"
          icon={<Smartphone size={20} color={palette.orange} />}
          onPress={openAppSettings}
          value="Permissions"
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Data & account">
        <SettingsRow
          label="Allow search history"
          icon={<Database size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={allowSearchHistory}
          onToggle={handleSearchHistoryToggle}
          isLast={false}
        />
        <SettingsRow
          label="Clear local cache"
          icon={<Database size={20} color={palette.orange} />}
          onPress={handleClearLocalData}
          isLast={false}
        />
        <SettingsRow
          label={isExportingData ? "Preparing your data…" : "Download my data"}
          icon={<Download size={20} color={palette.orange} />}
          onPress={handleExportData}
          busy={isExportingData}
          isLast={false}
        />
        <SettingsRow
          label="Data controls"
          icon={<Shield size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.accountDeletion)}
          isLast={false}
        />
        <SettingsRow
          label="Sign out"
          icon={<LogOut size={20} color={palette.orange} />}
          onPress={handleSignOut}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          label="Help Center"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.help)}
          isLast={false}
        />
        <SettingsRow
          label="Privacy Policy"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          isLast={false}
        />
        <SettingsRow
          label="Terms of Service"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="Version" type="value" value={appVersion} isLast={false} />
        <SettingsRow
          label="Hungry support"
          icon={<CircleHelp size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`)}
          isLast={false}
        />
        <SettingsRow
          label="Data sources"
          type="value"
          description="Venue details include data © OpenStreetMap contributors (ODbL), Overture Maps Foundation and Foursquare Open Source Places."
          isLast
        />
      </SettingsSection>

      <View style={{ gap: spacing[3], marginBottom: spacing[4], marginTop: spacing[1] }}>
        <Button
          label="Delete account"
          variant="destructive"
          onPress={handleDeleteAccount}
          loading={deletionRequested}
          leftIcon={<Trash2 size={20} color={palette.white} />}
        />
      </View>
    </ProfileScreenShell>
  );
}
