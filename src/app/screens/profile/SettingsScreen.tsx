import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Platform, Share, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Accessibility,
  AtSign,
  Compass,
  Database,
  Download,
  Eraser,
  Eye,
  FileText,
  Hand,
  History,
  Info,
  LocateFixed,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  RotateCcw,
  Scale,
  Settings2,
  Shield,
  SunMoon,
  Trash2,
  User,
  UtensilsCrossed,
  Vibrate,
} from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { Button } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { AccountDeletionCodeDialog } from "@/components/settings/AccountDeletionCodeDialog";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { foodOpennessLabel } from "@/constants/taste";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { trackAnalyticsEvent } from "@/lib/analytics";
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

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Automatic",
  light: "Light",
  dark: "Dark",
};

/** Supabase AuthErrors (wrong or expired code) keep the code dialog open. */
function isAuthCodeError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && name.startsWith("Auth");
}

function formatDeletionDate(scheduledFor: string): string {
  const date = new Date(scheduledFor);
  if (Number.isNaN(date.getTime())) return `in ${ACCOUNT_DELETION_GRACE_DAYS} days`;
  return `on ${date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`;
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const rootNavigation = getRootNavigation(navigation);
  const { palette, spacing } = useHungryTheme();

  const { clearSession, signOut, isAuthenticated } = useSessionStore(
    useShallow((state) => ({
      clearSession: state.clearSession,
      signOut: state.signOut,
      isAuthenticated: state.isAuthenticated,
    })),
  );
  const { clearProfile, setProfileVisibility, profile, resetFoodHistory } = useProfileStore(
    useShallow((state) => ({
      clearProfile: state.clearProfile,
      setProfileVisibility: state.setProfileVisibility,
      profile: state.profile,
      resetFoodHistory: state.resetFoodHistory,
    })),
  );
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const { clearSearchState, clearSearchHistory } = useSearchStore(
    useShallow((state) => ({
      clearSearchState: state.clearSearchState,
      clearSearchHistory: state.clearSearchHistory,
    })),
  );
  const {
    resetLocationState,
    grantLocation,
    clearManualLocation,
    syncLocationPermission,
    location,
    locationPermission,
  } = useLocationStore(
    useShallow((state) => ({
      resetLocationState: state.resetLocationState,
      grantLocation: state.grantLocation,
      clearManualLocation: state.clearManualLocation,
      syncLocationPermission: state.syncLocationPermission,
      location: state.manualLocation,
      locationPermission: state.permission,
    })),
  );
  const {
    themePreference,
    setThemePreference,
    hapticFeedbackEnabled,
    setHapticFeedbackEnabled,
    reducedMotionEnabled,
    setReducedMotionEnabled,
    allowSearchHistory,
    setAllowSearchHistory,
    leftHandedMode,
    setLeftHandedMode,
    showToast,
  } = useUIStore(
    useShallow((state) => ({
      themePreference: state.themePreference,
      setThemePreference: state.setThemePreference,
      hapticFeedbackEnabled: state.hapticFeedbackEnabled,
      setHapticFeedbackEnabled: state.setHapticFeedbackEnabled,
      reducedMotionEnabled: state.reducedMotionEnabled,
      setReducedMotionEnabled: state.setReducedMotionEnabled,
      allowSearchHistory: state.allowSearchHistory,
      setAllowSearchHistory: state.setAllowSearchHistory,
      leftHandedMode: state.leftHandedMode,
      setLeftHandedMode: state.setLeftHandedMode,
      showToast: state.showToast,
    })),
  );

  const isProfilePrivate = profile.profileVisibility === "private";

  const normalizedThemePreference: ThemePreference =
    themePreference === "system" || themePreference === "light" || themePreference === "dark"
      ? themePreference
      : "system";

  const [deletionRequested, setDeletionRequested] = useState(false);
  const [deletionCodeVisible, setDeletionCodeVisible] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

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
      trackAnalyticsEvent("settings_data_export_requested", { platform: Platform.OS });
      try {
        const exportData = await buildMyDataExport(getHungryService());
        const exportJson = JSON.stringify(exportData, null, 2);
        if (Platform.OS === "ios") {
          // Share a .json file; Android keeps the text share until expo-sharing ships natively.
          const exportFile = new File(Paths.cache, "hungry-data-export.json");
          exportFile.create({ overwrite: true });
          exportFile.write(exportJson);
          await Share.share({ title: "My Hungry data", url: exportFile.uri });
        } else {
          await Share.share({ title: "My Hungry data", message: exportJson });
        }
      } catch {
        trackAnalyticsEvent("settings_data_export_failed", {});
        Alert.alert(
          "Export failed",
          `We could not prepare your data right now. Please try again or email ${SUPPORT_EMAIL}.`,
        );
      } finally {
        setIsExportingData(false);
      }
    })();
  };

  // Step 2: the emailed code (any sign-in method, Google and Apple included) proves the
  // person deleting can read the account's email. A wrong code stays in the dialog.
  const submitDeletionCode = async (code: string) => {
    let scheduledFor: string;
    try {
      ({ scheduledFor } = await getHungryService().auth.requestAccountDeletion({
        reason: "user_initiated_settings_flow",
        code,
      }));
    } catch (error) {
      if (isAuthCodeError(error)) throw error;
      setDeletionCodeVisible(false);
      Alert.alert(
        "Deletion request failed",
        "We could not queue your account deletion request. Please try again or contact support.",
      );
      return;
    }
    setDeletionCodeVisible(false);
    setDeletionRequested(true);
    trackAnalyticsEvent("account_deletion_requested", { surface: "settings" });
    await purgePersistedAccountData();
    clearSession();
    clearProfile();
    clearSearchState();
    resetDraft();
    resetLocationState();
    // Replace the whole stack so Back cannot return to the signed-in screens.
    rootNavigation.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
    Alert.alert(
      "Deletion scheduled",
      `Your account will be deleted ${formatDeletionDate(scheduledFor)}. Sign in before then to keep it.`,
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      `Your account and personal data will be deleted in ${ACCOUNT_DELETION_GRACE_DAYS} days. Sign back in before then to keep your account. After that, deletion is permanent. Menu photos you shared stay on the stall without your name, and some security, moderation, or legal records may remain in anonymized form.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email me a code",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeletionRequested(true);
                await getHungryService().auth.sendAccountDeletionCode();
                setDeletionCodeVisible(true);
              } catch {
                Alert.alert(
                  "Couldn't send the code",
                  "Please wait a minute and try again, or contact support.",
                );
              } finally {
                setDeletionRequested(false);
              }
            })();
          },
        },
      ],
    );
  };

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    trackAnalyticsEvent("settings_changed", { setting: "theme", value: preference });
  };

  // Three choices fit Android's three-button limit; tapping outside keeps the current theme.
  const showThemePicker = () => {
    Alert.alert(
      "Theme",
      "Automatic follows your phone's setting.",
      (["system", "light", "dark"] as const).map((preference) => ({
        text:
          preference === normalizedThemePreference
            ? `${THEME_LABELS[preference]} ✓`
            : THEME_LABELS[preference],
        onPress: () => selectTheme(preference),
      })),
      { cancelable: true },
    );
  };

  const changeProfileVisibility = async (visibility: "public" | "private") => {
    if (visibility === profile.profileVisibility) return;
    setIsSavingVisibility(true);
    const saved = await setProfileVisibility(visibility);
    setIsSavingVisibility(false);
    trackAnalyticsEvent("settings_changed", {
      setting: "profile_visibility",
      value: visibility,
      saved,
    });
    if (saved) {
      showToast({
        message: visibility === "private" ? "Your profile is private." : "Your profile is public.",
        tone: "success",
      });
      return;
    }
    Alert.alert(
      "Couldn't change visibility",
      `Your profile is still ${visibility === "private" ? "public" : "private"}. Check your connection and try again.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: () => void changeProfileVisibility(visibility) },
      ],
    );
  };

  const showProfileVisibilityDialog = () => {
    Alert.alert("Profile visibility", "Choose who can see your Hungry profile.", [
      {
        text: "Public",
        onPress: () => void changeProfileVisibility("public"),
      },
      {
        text: "Private",
        onPress: () => void changeProfileVisibility("private"),
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
    trackAnalyticsEvent("settings_changed", { setting: "search_history", value: enabled });
    if (!enabled) {
      clearSearchHistory();
    }
  };

  const handleDeviceToggle =
    (setting: string, setter: (enabled: boolean) => void) => (enabled: boolean) => {
      setter(enabled);
      trackAnalyticsEvent("settings_changed", { setting, value: enabled });
    };

  const handleResetFoodHistory = () => {
    Alert.alert(
      "Reset food history",
      "Recommendations will forget the dishes you liked, tapped or hid. Your favourites and reviews stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetFoodHistory()
              .then(() => Alert.alert("Food history reset", "Recommendations start fresh."))
              .catch(() => Alert.alert("Couldn't reset", "Check your connection and try again."));
          },
        },
      ],
    );
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
              trackAnalyticsEvent("settings_local_cache_cleared", {});
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
          label="Edit profile"
          icon={<User size={20} color={palette.orange} />}
          onPress={() => navigation.navigate("EditProfile")}
          value={profile.displayName}
          isLast={false}
        />
        <SettingsRow
          label="Email"
          icon={<AtSign size={20} color={palette.orange} />}
          type="value"
          value={profile.email?.trim() || "Not linked"}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Taste and recommendations">
        <SettingsRow
          label="Trying new food"
          icon={<Compass size={20} color={palette.orange} />}
          type="navigation"
          value={foodOpennessLabel(resolveFoodOpenness(profile.tasteProfile))}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "FoodOpenness",
              params: { mode: "settings" },
            })
          }
          isLast={!isAuthenticated}
        />
        {isAuthenticated ? (
          <SettingsRow
            label="Reset food history"
            icon={<UtensilsCrossed size={20} color={palette.orange} />}
            onPress={handleResetFoodHistory}
            isLast
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title="Privacy and data">
        <SettingsRow
          label="Profile visibility"
          icon={
            isProfilePrivate ? (
              <Lock size={20} color={palette.orange} />
            ) : (
              <Eye size={20} color={palette.orange} />
            )
          }
          type="navigation"
          value={isSavingVisibility ? "Saving…" : isProfilePrivate ? "Private" : "Public"}
          onPress={showProfileVisibilityDialog}
          busy={isSavingVisibility}
          isLast={false}
        />
        <SettingsRow
          label="Allow search history"
          icon={<History size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={allowSearchHistory}
          onToggle={handleSearchHistoryToggle}
          isLast={false}
        />
        <SettingsRow
          label="Clear local cache"
          icon={<Eraser size={20} color={palette.orange} />}
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
          label="How account deletion works"
          icon={<Shield size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.accountDeletion)}
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

      <SettingsSection title="Location">
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
          icon={<LocateFixed size={20} color={palette.orange} />}
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
          icon={<RotateCcw size={20} color={palette.orange} />}
          onPress={handleResetLocation}
          isLast={false}
        />
        <SettingsRow
          label="Phone permissions"
          icon={<Settings2 size={20} color={palette.orange} />}
          onPress={openAppSettings}
          value="Open settings"
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Accessibility and display">
        <SettingsRow
          label="Theme"
          icon={<SunMoon size={20} color={palette.orange} />}
          type="navigation"
          value={THEME_LABELS[normalizedThemePreference]}
          onPress={showThemePicker}
          isLast={false}
        />
        <SettingsRow
          label="Reduce motion"
          icon={<Accessibility size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={reducedMotionEnabled}
          onToggle={handleDeviceToggle("reduce_motion", setReducedMotionEnabled)}
          isLast={false}
        />
        <SettingsRow
          label="Haptic feedback"
          icon={<Vibrate size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={hapticFeedbackEnabled}
          onToggle={handleDeviceToggle("haptic_feedback", setHapticFeedbackEnabled)}
          isLast={false}
        />
        <SettingsRow
          label="Left-handed mode"
          description="Moves floating buttons to the left side."
          icon={<Hand size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={leftHandedMode}
          onToggle={handleDeviceToggle("left_handed_mode", setLeftHandedMode)}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          label="Contact us"
          icon={<MessageCircle size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.help)}
          isLast={false}
        />
        <SettingsRow
          label="Email support"
          icon={<Mail size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`)}
          isLast={false}
        />
        <SettingsRow
          label="Privacy Policy"
          icon={<FileText size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          isLast={false}
        />
        <SettingsRow
          label="Terms of Service"
          icon={<Scale size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          label="Version"
          icon={<Info size={20} color={palette.orange} />}
          type="value"
          value={appVersion}
          isLast={false}
        />
        <SettingsRow
          label="Data sources"
          icon={<Database size={20} color={palette.orange} />}
          type="value"
          description="Venue details include data © OpenStreetMap contributors (ODbL), Overture Maps Foundation and Foursquare Open Source Places."
          isLast
        />
      </SettingsSection>

      {isAuthenticated ? (
        <SettingsSection>
          <SettingsRow
            label="Sign out"
            icon={<LogOut size={20} color={palette.error} />}
            onPress={handleSignOut}
            destructive
            isLast
          />
        </SettingsSection>
      ) : null}

      <View style={{ gap: spacing[3], marginBottom: spacing[4], marginTop: spacing[1] }}>
        <Button
          label="Delete account"
          variant="destructive"
          onPress={handleDeleteAccount}
          loading={deletionRequested}
          leftIcon={<Trash2 size={20} color={palette.white} />}
        />
      </View>
      <AccountDeletionCodeDialog
        visible={deletionCodeVisible}
        email={profile.email}
        onSubmit={submitDeletionCode}
        onCancel={() => setDeletionCodeVisible(false)}
      />
    </ProfileScreenShell>
  );
}
