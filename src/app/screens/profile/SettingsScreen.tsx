import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert, AppState, Linking, Platform, Share, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Accessibility,
  AtSign,
  Ban,
  Compass,
  Database,
  Download,
  Eraser,
  Eye,
  FileText,
  Hand,
  History,
  Info,
  KeyRound,
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
  Smartphone,
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
import { SettingsChoiceSheet } from "@/components/settings/SettingsChoiceSheet";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { foodOpennessLabel } from "@/constants/taste";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/services/types";
import { clearImageCache } from "@/features/navigation/prefetch";
import { buildMyDataExport } from "@/features/profile/exportMyData";
import {
  canShareExportAsText,
  deleteExportFile,
  writeExportFile,
} from "@/features/profile/exportFile";
import { isNoAccountEmailError } from "@/features/auth/accountDeletionErrors";
import { formatDeletionDate } from "@/features/auth/useAccountDeletionGracePrompt";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { expectSignOut, useSessionStore } from "@/store/useSessionStore";
import { ThemePreference, useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { PendingDeletionBanner } from "@/features/auth/PendingDeletionBanner";
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

/** "on 14 November 2026", using the same date format as the grace-period prompt. */
function describeDeletionDate(scheduledFor: string): string {
  const label = formatDeletionDate(scheduledFor);
  return label === "soon" ? `in ${ACCOUNT_DELETION_GRACE_DAYS} days` : `on ${label}`;
}

const THEME_DESCRIPTIONS: Record<ThemePreference, string> = {
  system: "Follows your phone's setting.",
  light: "Always light.",
  dark: "Always dark.",
};

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
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);

  // Version, native build and the over-the-air update, so support can tell builds apart.
  const buildNumber = Constants.nativeBuildVersion;
  const shortUpdateId = Updates.updateId?.slice(0, 8);
  const appVersion = [
    Constants.expoConfig?.version ?? "0.1.0",
    buildNumber ? `(${buildNumber})` : null,
    shortUpdateId ? `update ${shortUpdateId}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Google/Apple-only accounts have no password to change, so that row stays hidden.
  useEffect(() => {
    if (!isAuthenticated) return;
    let isActive = true;
    getHungryService()
      .auth.canChangePassword()
      .then((allowed) => {
        if (isActive) setCanChangePassword(allowed);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

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
        if (Platform.OS === "ios") {
          // Share a .json file, then remove it: it is a full copy of the person's data.
          const exportJson = JSON.stringify(exportData, null, 2);
          try {
            await Share.share({ title: "My Hungry data", url: writeExportFile(exportJson) });
          } finally {
            deleteExportFile();
          }
        } else {
          // Android shares text until expo-sharing ships in a native build. An intent over
          // about 1 MB fails, so a large export is requested by email instead.
          const exportJson = JSON.stringify(exportData);
          if (canShareExportAsText(exportJson)) {
            await Share.share({ title: "My Hungry data", message: exportJson });
          } else {
            Alert.alert(
              "Your export is large",
              `Your data is too big to share from the app on this phone. Email ${SUPPORT_EMAIL} and we will send you a copy.`,
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Email support",
                  onPress: () =>
                    void openTrustedExternalUrl(
                      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("My Hungry data export")}`,
                    ),
                },
              ],
            );
          }
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
    // The service signs out as part of the request; that is not an expired session.
    expectSignOut();
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
    deleteExportFile();
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
      `Your account will be deleted ${describeDeletionDate(scheduledFor)}. To keep it, sign in before then and choose Keep my account.`,
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      `Your profile is hidden straight away, and your account and personal data will be deleted in ${ACCOUNT_DELETION_GRACE_DAYS} days. To keep your account, sign in before then and choose Keep my account. After that, deletion is permanent. Menu photos you shared stay on the stall without your name, and some security, moderation, or legal records may remain in anonymized form.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email me a code",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeletionRequested(true);
                // A merchant owner must hand the business over first; say so before any code is sent.
                if ((await getHungryService().auth.getAccountDeletionBlocker()) !== null) {
                  Alert.alert(
                    "Transfer your business first",
                    `You own a merchant account on Hungry. Deleting your account would leave the stall without an owner. Email ${SUPPORT_EMAIL} to hand it over, then delete your account.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Email support",
                        onPress: () => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`),
                      },
                    ],
                  );
                  return;
                }
                await getHungryService().auth.sendAccountDeletionCode();
                setDeletionCodeVisible(true);
              } catch (error) {
                Alert.alert(
                  "Couldn't send the code",
                  isNoAccountEmailError(error)
                    ? `This account has no email address, so we can't send a code. Email ${SUPPORT_EMAIL} and we will help you delete it.`
                    : "Please wait a minute and try again, or contact support.",
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

  const resendDeletionCode = () => getHungryService().auth.sendAccountDeletionCode();

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    trackAnalyticsEvent("settings_changed", { setting: "theme", value: preference });
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
      "Recommendations will forget your dish history: the dishes you liked, tapped or hid. Your taste profile, favourites and reviews stay.",
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
      "This removes recent searches, unsent review drafts, cached images and any saved data export on this device. You stay signed in.",
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
              deleteExportFile();
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

  const handleSignOutEverywhere = () => {
    Alert.alert(
      "Sign out of all devices",
      "This signs you out of Hungry on every phone, including this one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out everywhere",
          style: "destructive",
          onPress: () => {
            void getHungryService()
              .auth.signOut({ scope: "global" })
              .then(() => {
                signOut();
                rootNavigation.reset({
                  index: 0,
                  routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                });
              })
              .catch(() =>
                Alert.alert(
                  "Couldn't sign out everywhere",
                  "Check your connection and try again. You are still signed in.",
                ),
              );
          },
        },
      ],
    );
  };

  const handleCopyVersion = () => {
    void Clipboard.setStringAsync(`Hungry ${appVersion}`)
      .then(() => showToast({ message: "Version copied.", tone: "success" }))
      .catch(() => undefined);
  };

  return (
    <ProfileScreenShell title="Settings">
      {isAuthenticated ? <PendingDeletionBanner /> : null}
      {isAuthenticated ? (
        <>
          <SettingsSection title="Account">
            <SettingsRow
              label="Edit profile"
              icon={<User size={20} color={palette.orange} />}
              onPress={() => navigation.navigate("EditProfile")}
              value={profile.displayName}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Sign-in and security">
            <SettingsRow
              label="Email"
              icon={<AtSign size={20} color={palette.orange} />}
              type="navigation"
              value={profile.email?.trim() || "Not linked"}
              description="Change it in Edit profile."
              onPress={() => navigation.navigate("EditProfile")}
              isLast={false}
            />
            {canChangePassword && isAuthenticated ? (
              <SettingsRow
                label="Change password"
                icon={<KeyRound size={20} color={palette.orange} />}
                onPress={() => rootNavigation.navigate("ChangePassword")}
                isLast={false}
              />
            ) : null}
            <SettingsRow
              label="Sign out of all devices"
              description="Ends your Hungry session on every phone, including this one."
              icon={<Smartphone size={20} color={palette.orange} />}
              onPress={handleSignOutEverywhere}
              isLast
            />
          </SettingsSection>
        </>
      ) : (
        <SettingsSection
          title="Account"
          description="You're browsing as a guest. Sign in to save dishes, write reviews and keep your settings."
        >
          <SettingsRow
            label="Sign in or create an account"
            icon={<User size={20} color={palette.orange} />}
            onPress={() => rootNavigation.navigate("AuthStack", { screen: "Login" })}
            isLast
          />
        </SettingsSection>
      )}

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
        {isAuthenticated ? (
          <>
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
              onPress={() => setVisibilitySheetVisible(true)}
              busy={isSavingVisibility}
              isLast={false}
            />
            <SettingsRow
              label="Blocked accounts"
              icon={<Ban size={20} color={palette.orange} />}
              onPress={() => rootNavigation.navigate("BlockedAccounts")}
              isLast={false}
            />
          </>
        ) : null}
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
        {isAuthenticated ? (
          <SettingsRow
            label={isExportingData ? "Preparing your data…" : "Download my data"}
            icon={<Download size={20} color={palette.orange} />}
            onPress={handleExportData}
            busy={isExportingData}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          label="How account deletion works"
          icon={<Shield size={20} color={palette.orange} />}
          type="link"
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
          value={location || (locationPermission === "granted" ? "Use GPS" : "Not set")}
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
          onPress={() => setThemeSheetVisible(true)}
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
          description="Moves floating buttons, like the add-menu button and the like and save buttons on posts, to the left side."
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
          type="link"
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
          type="link"
          icon={<FileText size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          isLast={false}
        />
        <SettingsRow
          label="Terms of Service"
          type="link"
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
          description="Press and hold to copy."
          onLongPress={handleCopyVersion}
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

      {isAuthenticated ? (
        <View style={{ gap: spacing[3], marginBottom: spacing[4], marginTop: spacing[1] }}>
          <Button
            label="Delete account"
            variant="destructive"
            onPress={handleDeleteAccount}
            loading={deletionRequested}
            leftIcon={<Trash2 size={20} color={palette.white} />}
          />
        </View>
      ) : null}
      <AccountDeletionCodeDialog
        visible={deletionCodeVisible}
        email={profile.email}
        onSubmit={submitDeletionCode}
        onResend={resendDeletionCode}
        onCancel={() => setDeletionCodeVisible(false)}
      />
      <SettingsChoiceSheet
        visible={themeSheetVisible}
        title="Theme"
        options={(["system", "light", "dark"] as const).map((preference) => ({
          value: preference,
          label: THEME_LABELS[preference],
          description: THEME_DESCRIPTIONS[preference],
        }))}
        selected={normalizedThemePreference}
        onSelect={(preference) => {
          selectTheme(preference);
          setThemeSheetVisible(false);
        }}
        onClose={() => setThemeSheetVisible(false)}
      />
      <SettingsChoiceSheet
        visible={visibilitySheetVisible}
        title="Profile visibility"
        message="Private: only approved followers see your posts, Lists and the reviews on your profile. Your reviews still show on dish pages."
        options={[
          {
            value: "public" as const,
            label: "Public",
            description: "Anyone can see your profile, posts and Lists.",
          },
          {
            value: "private" as const,
            label: "Private",
            description: "Only approved followers see your posts, Lists and profile reviews.",
          },
        ]}
        selected={isProfilePrivate ? "private" : "public"}
        onSelect={(visibility) => {
          setVisibilitySheetVisible(false);
          void changeProfileVisibility(visibility);
        }}
        onClose={() => setVisibilitySheetVisible(false)}
      />
    </ProfileScreenShell>
  );
}
