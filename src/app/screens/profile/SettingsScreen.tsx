import Constants from "expo-constants";
import { useState } from "react";
import { Alert, Linking, Share, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AtSign,
  Bell,
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
  Star,
  Smartphone,
  User,
  Trash2,
} from "lucide-react-native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/services/types";
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
  const resetLocationState = useLocationStore((state) => state.resetLocationState);
  const signOut = useSessionStore((state) => state.signOut);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const denyLocation = useLocationStore((state) => state.denyLocation);
  const setProfileVisibility = useProfileStore((state) => state.setProfileVisibility);
  const setLeftHandedMode = useProfileStore((state) => state.setLeftHandedMode);

  const themePreference = useUIStore((state) => state.themePreference);
  const setThemePreference = useUIStore((state) => state.setThemePreference);
  const hapticFeedbackEnabled = useUIStore((state) => state.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useUIStore((state) => state.setHapticFeedbackEnabled);
  const reducedMotionEnabled = useUIStore((state) => state.reducedMotionEnabled);
  const setReducedMotionEnabled = useUIStore((state) => state.setReducedMotionEnabled);
  const showLocationBadge = useUIStore((state) => state.showLocationBadge);
  const setShowLocationBadge = useUIStore((state) => state.setShowLocationBadge);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const setAllowSearchHistory = useUIStore((state) => state.setAllowSearchHistory);
  const openToExternalApps = useUIStore((state) => state.openToExternalApps);
  const setOpenToExternalApps = useUIStore((state) => state.setOpenToExternalApps);
  const dietaryFiltersEnabled = useUIStore((state) => state.dietaryFiltersEnabled);
  const setDietaryFiltersEnabled = useUIStore((state) => state.setDietaryFiltersEnabled);
  const activityFeedEnabled = useUIStore((state) => state.activityFeedEnabled);
  const setActivityFeedEnabled = useUIStore((state) => state.setActivityFeedEnabled);
  const hideReviewedDishesFromFeed = useUIStore((state) => state.hideReviewedDishesFromFeed);
  const setHideReviewedDishesFromFeed = useUIStore((state) => state.setHideReviewedDishesFromFeed);
  const showOnlyFavoriteDishes = useUIStore((state) => state.showOnlyFavoriteDishes);
  const setShowOnlyFavoriteDishes = useUIStore((state) => state.setShowOnlyFavoriteDishes);
  const pushNotificationsEnabled = useUIStore((state) => state.pushNotificationsEnabled);
  const setPushNotificationsEnabled = useUIStore((state) => state.setPushNotificationsEnabled);
  const missionNotificationsEnabled = useUIStore((state) => state.missionNotificationsEnabled);
  const setMissionNotificationsEnabled = useUIStore(
    (state) => state.setMissionNotificationsEnabled,
  );
  const showCredTier = useUIStore((state) => state.showCredTier);
  const setShowCredTier = useUIStore((state) => state.setShowCredTier);
  const showPassportProgress = useUIStore((state) => state.showPassportProgress);
  const setShowPassportProgress = useUIStore((state) => state.setShowPassportProgress);
  const showProfileBadges = useUIStore((state) => state.showProfileBadges);
  const setShowProfileBadges = useUIStore((state) => state.setShowProfileBadges);

  const profile = useProfileStore((state) => state.profile);
  const location = useLocationStore((state) => state.manualLocation);
  const locationPermission = useLocationStore((state) => state.permission);
  const isProfilePrivate = profile.profileVisibility === "private";
  const showNotificationSettings = FEATURE_FLAGS.notificationsEnabled;
  const showGamificationSettings = FEATURE_FLAGS.gamificationEnabled;

  const normalizedThemePreference: ThemePreference =
    themePreference === "system" || themePreference === "light" || themePreference === "dark"
      ? themePreference
      : "system";

  const [deletionRequested, setDeletionRequested] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

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

  const handleLocationPermissionToggle = async (enabled: boolean) => {
    if (enabled) {
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
      return;
    }

    denyLocation();
    void openAppSettings();
  };

  const handleResetLocation = () => {
    Alert.alert(
      "Reset location",
      "This will clear your selected manual location and use GPS defaults.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: () => {
            resetLocationState();
            Alert.alert("Location reset", "Your manual location has been cleared.");
          },
        },
      ],
    );
  };

  const handleClearLocalData = () => {
    Alert.alert("Clear local settings", "This will remove cached searches and draft content.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        onPress: () => {
          void (async () => {
            await purgePersistedAccountData();
            resetDraft();
            clearSearchState();
            Alert.alert("Local data cleared", "Cached app data was removed from this device.");
          })();
        },
      },
    ]);
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
          isLast={false}
        />
        <SettingsRow
          label="Hide reviewed dishes from public feed"
          icon={<Bell size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={hideReviewedDishesFromFeed}
          onToggle={setHideReviewedDishesFromFeed}
          isLast={!showGamificationSettings}
        />
        {showGamificationSettings ? (
          <>
            <SettingsRow
              label="Show Food Cred tier"
              icon={<Star size={20} color={palette.orange} />}
              type="toggle"
              isEnabled={showCredTier}
              onToggle={setShowCredTier}
              isLast={false}
            />
            <SettingsRow
              label="Show Passport progress"
              icon={<Globe size={20} color={palette.orange} />}
              type="toggle"
              isEnabled={showPassportProgress}
              onToggle={setShowPassportProgress}
              isLast
            />
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Location & Discovery">
        <SettingsRow
          label="Location"
          icon={<MapPin size={20} color={palette.orange} />}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", { screen: "ManualLocationPicker" })
          }
          value={location || "Use GPS"}
          isLast={false}
        />
        <SettingsRow
          label="Location permission"
          icon={<MapPin size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={locationPermission === "granted"}
          onToggle={handleLocationPermissionToggle}
          isLast={false}
        />
        <SettingsRow
          label="Show location badge"
          icon={<MapPin size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={showLocationBadge}
          onToggle={setShowLocationBadge}
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
          label="Dietary filters"
          icon={<Shield size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={dietaryFiltersEnabled}
          onToggle={setDietaryFiltersEnabled}
          isLast={false}
        />
        <SettingsRow
          label="Show activity feed"
          icon={<Star size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={activityFeedEnabled}
          onToggle={setActivityFeedEnabled}
          isLast={false}
        />
        <SettingsRow
          label="Left-handed mode"
          icon={<HandMetal size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={profile.leftHandedMode}
          onToggle={setLeftHandedMode}
          isLast={false}
        />
        <SettingsRow
          label="Show only favourite dishes"
          icon={<Globe size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={showOnlyFavoriteDishes}
          onToggle={setShowOnlyFavoriteDishes}
          isLast
        />
      </SettingsSection>

      {showNotificationSettings || showGamificationSettings ? (
        <SettingsSection title="Notifications">
          {showNotificationSettings ? (
            <SettingsRow
              label="Push notifications"
              icon={<Bell size={20} color={palette.orange} />}
              type="toggle"
              isEnabled={pushNotificationsEnabled}
              onToggle={setPushNotificationsEnabled}
              isLast={!showGamificationSettings}
            />
          ) : null}
          {showGamificationSettings ? (
            <SettingsRow
              label="Mission notifications"
              icon={<Bell size={20} color={palette.orange} />}
              type="toggle"
              isEnabled={missionNotificationsEnabled}
              onToggle={setMissionNotificationsEnabled}
              isLast
            />
          ) : null}
        </SettingsSection>
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
        {showGamificationSettings ? (
          <SettingsRow
            label="Show badges on profile"
            icon={<Star size={20} color={palette.orange} />}
            type="toggle"
            isEnabled={showProfileBadges}
            onToggle={setShowProfileBadges}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          label="Open in external browsers"
          icon={<Globe size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={openToExternalApps}
          onToggle={setOpenToExternalApps}
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
          onToggle={setAllowSearchHistory}
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
          onPress={isExportingData ? undefined : handleExportData}
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
