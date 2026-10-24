import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
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
  UserX,
  UtensilsCrossed,
  Vibrate,
} from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { Button, Dialog } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { AccountDeletionCodeDialog } from "@/components/settings/AccountDeletionCodeDialog";
import { SettingsChoiceSheet } from "@/components/settings/SettingsChoiceSheet";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { foodOpennessLabel } from "@/constants/taste";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
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
import { useMerchantStore } from "@/store/useMerchantStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { expectSignOut, useSessionStore } from "@/store/useSessionStore";
import { ThemePreference, useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { PendingDeletionBanner } from "@/features/auth/PendingDeletionBanner";
import { useHungryTheme } from "@/theme";
import { BLOCKED_AND_HIDDEN_TITLE } from "./BlockedAndHiddenScreen";
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

/** The deletion RPC refuses a merchant owner who has not handed the business over. */
function isOwnerMustTransferError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.includes("merchant_owner_must_transfer");
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

  const setAuthNotice = useSessionStore((state) => state.setAuthNotice);
  const { signOut, isAuthenticated } = useSessionStore(
    useShallow((state) => ({
      signOut: state.signOut,
      isAuthenticated: state.isAuthenticated,
    })),
  );
  const { setProfileVisibility, profile, resetFoodHistory } = useProfileStore(
    useShallow((state) => ({
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
    grantLocation,
    clearManualLocation,
    syncLocationPermission,
    location,
    locationPermission,
  } = useLocationStore(
    useShallow((state) => ({
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
  // Left-handed mode only moves the merchant menu's add button, so only merchants see it.
  const hasMerchantAccount = useMerchantStore((state) => state.account !== null);
  // A/B: Dining preferences folded (control) or open (unfolded). The section is the first
  // thing on Settings in both arms, so exposure on mount is exposure to the variant.
  const diningVariant = useExperimentVariant("settings_dining_unfolded_v1", {
    enabled: isAuthenticated,
  });

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
  const [deletionPending, setDeletionPending] = useState(false);
  const handlePendingDeletionChange = useCallback(
    (pending: boolean) => setDeletionPending(pending),
    [],
  );

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
      .catch((error: unknown) => reportError(error, { area: "settings_can_change_password" }));
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
      } catch (error) {
        reportError(error, { area: "settings_data_export" });
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

  const [accountDialog, setAccountDialog] = useState<
    | "signOut"
    | "deleteAccount"
    | "deleteFailed"
    | "codeSendFailed"
    | "ownerBlocked"
    | "noAccountEmail"
    | null
  >(null);

  const resetToLogin = () => {
    // Only matters when the signed-in navigator stays mounted (E2E launcher);
    // otherwise AppBody swaps to the pre-auth navigator on sign-out.
    rootNavigation.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  };

  const handleDeleteAccount = () => {
    trackAnalyticsEvent("account_deletion_started", { surface: "settings" });
    setAccountDialog("deleteAccount");
  };

  // Step 1: email a code (works for Google and Apple accounts too).
  const sendDeletionCode = async () => {
    setDeletionRequested(true);
    try {
      // A merchant owner must hand the business over first; say so before any code is sent.
      if ((await getHungryService().auth.getAccountDeletionBlocker()) !== null) {
        setAccountDialog("ownerBlocked");
        return;
      }
      await getHungryService().auth.sendAccountDeletionCode();
      trackAnalyticsEvent("account_deletion_code_sent", { surface: "settings" });
      setDeletionCodeVisible(true);
    } catch (error) {
      if (!isNoAccountEmailError(error))
        reportError(error, { area: "settings_deletion_code_send" });
      setAccountDialog(isNoAccountEmailError(error) ? "noAccountEmail" : "codeSendFailed");
    } finally {
      setDeletionRequested(false);
    }
  };

  // Step 2: the emailed code proves the person deleting can read the account's email.
  // A wrong code stays in the code dialog.
  const submitDeletionCode = async (code: string) => {
    let scheduledFor: string;
    // The service signs out as part of the request; that is not an expired session.
    expectSignOut();
    try {
      ({ scheduledFor } = await getHungryService().auth.requestAccountDeletion({
        reason: "user_initiated_settings_flow",
        code,
      }));
      trackAnalyticsEvent("account_deletion_requested", { surface: "settings" });
    } catch (error) {
      if (isAuthCodeError(error)) throw error;
      setDeletionCodeVisible(false);
      if (isOwnerMustTransferError(error)) {
        setAccountDialog("ownerBlocked");
        return;
      }
      reportError(error, { area: "settings_deletion_request" });
      setAccountDialog("deleteFailed");
      return;
    }
    setDeletionCodeVisible(false);
    setDeletionRequested(true);

    // The deletion request is queued at this point. A local purge failure must
    // not be reported as a failed deletion request.
    let purgeFailed = false;
    try {
      await purgePersistedAccountData();
    } catch (error) {
      reportError(error, { area: "settings_deletion_local_purge" });
      purgeFailed = true;
    }

    deleteExportFile();

    // Shown on Login after sign-out (the Settings screen unmounts on sign-out).
    setAuthNotice({
      message: purgeFailed
        ? "Account deletion requested and you've been signed out. Some data saved on this device could not be cleared; reinstall Hungry to remove it."
        : `Account deletion requested and you've been signed out. Hungry will delete your account and personal data ${describeDeletionDate(scheduledFor)}. To keep it, sign in before then and choose Keep my account.`,
      tone: "success",
    });
    // Deletion ends every device's session (this one too, below); best effort.
    await getHungryService()
      .auth.signOut({ scope: "global" })
      .catch(() => undefined);
    signOut();
    resetToLogin();
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
    } catch (error) {
      reportError(error, { area: "settings_open_app_settings" });
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
          { text: "Open settings", onPress: () => void openAppSettings() },
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
              .catch((error: unknown) => {
                reportError(error, { area: "settings_reset_food_history" });
                Alert.alert("Couldn't reset", "Check your connection and try again.");
              });
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

  const handleSignOut = () => setAccountDialog("signOut");

  const runSignOut = () => {
    // useSessionStore.signOut clears every account-scoped store (search, review
    // draft, location, social, profile) so all sign-out entry points match.
    signOut();
    resetToLogin();
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
              .catch((error: unknown) => {
                reportError(error, { area: "settings_sign_out_everywhere" });
                Alert.alert(
                  "Couldn't sign out everywhere",
                  "Check your connection and try again. You are still signed in.",
                );
              });
          },
        },
      ],
    );
  };

  const handleCopyVersion = () => {
    void Clipboard.setStringAsync(`Hungry ${appVersion}`)
      .then(() => showToast({ message: "Version copied.", tone: "success" }))
      .catch((error: unknown) => reportError(error, { area: "settings_copy_version" }));
  };

  const foodOpenness = foodOpennessLabel(resolveFoodOpenness(profile.tasteProfile));
  const diningSummary = [
    profile.dietaryPreferences.length ? `${profile.dietaryPreferences.length} dietary` : null,
    profile.maxDishBudget ? `up to S$${profile.maxDishBudget}` : null,
    foodOpenness,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <ProfileScreenShell title="Settings">
      {/* First, so a pending deletion and Keep my account are the first thing seen. */}
      {isAuthenticated ? (
        <PendingDeletionBanner onPendingChange={handlePendingDeletionChange} />
      ) : null}
      <SettingsSection
        // Remount when the variant resolves after flags load, so the fold state follows it.
        key={`dining-${diningVariant}`}
        editorial
        collapsible
        defaultCollapsed={diningVariant === "control"}
        title="Dining preferences"
        collapsedSummary={diningSummary}
      >
        <SettingsRow
          editorial
          label="Dietary preferences"
          description="Choose the dietary flags used for your recommendations."
          icon={<UtensilsCrossed size={20} color={palette.orange} />}
          type="navigation"
          value={
            profile.dietaryPreferences.length
              ? `${profile.dietaryPreferences.length} selected`
              : "None selected"
          }
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "dietary" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Flavour profile"
          description="Review the taste answers behind your recommendations."
          icon={<Compass size={20} color={palette.orange} />}
          type="navigation"
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "taste" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Meal budget"
          icon={<UtensilsCrossed size={20} color={palette.orange} />}
          type="navigation"
          value={profile.maxDishBudget ? `Up to S$${profile.maxDishBudget}` : "Not set"}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "dietary" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Trying new food"
          icon={<Compass size={20} color={palette.orange} />}
          type="navigation"
          value={foodOpenness}
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
            editorial
            label="Reset food history"
            icon={<UtensilsCrossed size={20} color={palette.orange} />}
            onPress={handleResetFoodHistory}
            isLast
          />
        ) : null}
      </SettingsSection>

      <SettingsSection editorial title="Location & notifications">
        <SettingsRow
          editorial
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
          editorial
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
          editorial
          label="Reset selected location"
          icon={<RotateCcw size={20} color={palette.orange} />}
          onPress={handleResetLocation}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Phone permissions"
          icon={<Settings2 size={20} color={palette.orange} />}
          onPress={openAppSettings}
          value="Open settings"
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

      {isAuthenticated ? (
        <>
          <SettingsSection editorial title="Account & sync">
            <SettingsRow
              editorial
              label="Edit profile"
              icon={<User size={20} color={palette.orange} />}
              onPress={() => navigation.navigate("EditProfile")}
              value={profile.displayName}
              isLast
            />
          </SettingsSection>

          <SettingsSection editorial title="Sign-in and security">
            <SettingsRow
              editorial
              label="Email"
              icon={<AtSign size={20} color={palette.orange} />}
              type="navigation"
              value={profile.email?.trim() || "Not linked"}
              description="Change it in Edit profile."
              onPress={() => navigation.navigate("EditProfile")}
              isLast={false}
            />
            {canChangePassword ? (
              <SettingsRow
                editorial
                label="Change password"
                icon={<KeyRound size={20} color={palette.orange} />}
                onPress={() => rootNavigation.navigate("ChangePassword")}
                isLast={false}
              />
            ) : null}
            <SettingsRow
              editorial
              label="Sign out of all devices"
              description="Ends your Hungry session on every phone, including this one."
              icon={<Smartphone size={20} color={palette.orange} />}
              onPress={handleSignOutEverywhere}
              isLast
            />
          </SettingsSection>
        </>
      ) : null}

      <SettingsSection editorial title="Data & privacy">
        {isAuthenticated ? (
          <SettingsRow
            label="Profile visibility"
            editorial
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
        ) : null}
        {isAuthenticated ? (
          <SettingsRow
            editorial
            label={BLOCKED_AND_HIDDEN_TITLE}
            icon={<UserX size={20} color={palette.orange} />}
            type="navigation"
            onPress={() => rootNavigation.navigate("BlockedAndHidden")}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          editorial
          label="Allow search history"
          icon={<History size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={allowSearchHistory}
          onToggle={handleSearchHistoryToggle}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Clear local cache"
          icon={<Eraser size={20} color={palette.orange} />}
          onPress={handleClearLocalData}
          isLast={false}
        />
        {isAuthenticated ? (
          <SettingsRow
            editorial
            label={isExportingData ? "Preparing your data…" : "Download my data"}
            icon={<Download size={20} color={palette.orange} />}
            onPress={handleExportData}
            busy={isExportingData}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          editorial
          label="How account deletion works"
          icon={<Shield size={20} color={palette.orange} />}
          type="link"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.accountDeletion)}
          isLast
        />
      </SettingsSection>

      <SettingsSection editorial title="Accessibility and display">
        <SettingsRow
          editorial
          label="Theme"
          icon={<SunMoon size={20} color={palette.orange} />}
          type="navigation"
          value={THEME_LABELS[normalizedThemePreference]}
          onPress={() => setThemeSheetVisible(true)}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Reduce motion"
          icon={<Accessibility size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={reducedMotionEnabled}
          onToggle={handleDeviceToggle("reduce_motion", setReducedMotionEnabled)}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Haptic feedback"
          icon={<Vibrate size={20} color={palette.orange} />}
          type="toggle"
          isEnabled={hapticFeedbackEnabled}
          onToggle={handleDeviceToggle("haptic_feedback", setHapticFeedbackEnabled)}
          isLast={!hasMerchantAccount}
        />
        {hasMerchantAccount ? (
          <SettingsRow
            editorial
            label="Left-handed mode"
            description="Moves the add button on your merchant menu to the left side."
            icon={<Hand size={20} color={palette.orange} />}
            type="toggle"
            isEnabled={leftHandedMode}
            onToggle={handleDeviceToggle("left_handed_mode", setLeftHandedMode)}
            isLast
          />
        ) : null}
      </SettingsSection>

      <SettingsSection editorial title="Support">
        <SettingsRow
          editorial
          label="Contact us"
          type="link"
          icon={<MessageCircle size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.help)}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Email support"
          type="link"
          icon={<Mail size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`)}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Privacy policy"
          type="link"
          icon={<FileText size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Terms of service"
          type="link"
          icon={<Scale size={20} color={palette.orange} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
          isLast
        />
      </SettingsSection>

      <SettingsSection editorial title="About">
        <SettingsRow
          editorial
          label="Version"
          icon={<Info size={20} color={palette.orange} />}
          type="value"
          value={appVersion}
          description="Tap to copy."
          onPress={handleCopyVersion}
          onLongPress={handleCopyVersion}
          isLast={false}
        />
        <SettingsRow
          editorial
          label="Data sources"
          icon={<Database size={20} color={palette.orange} />}
          type="value"
          description="Venue details include data © OpenStreetMap contributors (ODbL), Overture Maps Foundation and Foursquare Open Source Places."
          isLast
        />
      </SettingsSection>

      {isAuthenticated ? (
        <SettingsSection editorial>
          <SettingsRow
            editorial
            label="Sign out"
            icon={<LogOut size={20} color={palette.error} />}
            onPress={handleSignOut}
            destructive
            isLast
          />
        </SettingsSection>
      ) : null}

      {/* While a request is pending, Keep my account (top) is the action; no second request. */}
      {isAuthenticated && !deletionPending ? (
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

      {/* Cross-platform confirm (Alert.alert is a no-op on web, so E2E can't drive it). */}
      <Dialog
        visible={accountDialog === "signOut"}
        title="Sign out"
        message="You will be signed out from Hungry on this device."
        buttons={[
          { text: "Sign out", style: "destructive", onPress: runSignOut },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setAccountDialog(null)}
      />
      <Dialog
        visible={accountDialog === "deleteAccount"}
        title="Delete account"
        message={`Your profile is hidden straight away, and your account and personal data will be deleted in ${ACCOUNT_DELETION_GRACE_DAYS} days. To keep your account, sign in before then and choose Keep my account. After that, deletion is permanent. Menu photos you shared stay on the stall without your name, and some security, moderation, or legal records may remain in anonymized form.`}
        buttons={[
          {
            text: "Email me a code",
            style: "destructive",
            onPress: () => {
              void sendDeletionCode();
            },
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() =>
          setAccountDialog((current) => (current === "deleteAccount" ? null : current))
        }
      />
      <Dialog
        visible={accountDialog === "deleteFailed"}
        title="Deletion request failed"
        message="We could not queue your account deletion request. Please try again or contact support."
        buttons={[{ text: "OK", style: "cancel" }]}
        onClose={() => setAccountDialog(null)}
      />
      <Dialog
        visible={accountDialog === "noAccountEmail"}
        title="Couldn't send the code"
        message={`This account has no email address, so we can't send a code. Email ${SUPPORT_EMAIL} and we will help you delete it.`}
        buttons={[{ text: "OK", style: "cancel" }]}
        onClose={() => setAccountDialog(null)}
      />
      <Dialog
        visible={accountDialog === "codeSendFailed"}
        title="Couldn't send the code"
        message="Please wait a minute and try again, or contact support."
        buttons={[{ text: "OK", style: "cancel" }]}
        onClose={() => setAccountDialog(null)}
      />
      <Dialog
        visible={accountDialog === "ownerBlocked"}
        title="Transfer your business first"
        message={`You own a merchant account on Hungry. Deleting your account would leave the stall without an owner. Email ${SUPPORT_EMAIL} to hand it over, then delete your account.`}
        buttons={[
          {
            text: "Email support",
            onPress: () => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setAccountDialog(null)}
      />
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
        visible={isAuthenticated && visibilitySheetVisible}
        title="Profile visibility"
        message="Private: only approved followers see your Lists and the reviews on your profile. Your reviews still show on dish pages."
        options={[
          {
            value: "public" as const,
            label: "Public",
            description: "Anyone can see your profile and Lists.",
          },
          {
            value: "private" as const,
            label: "Private",
            description: "Only approved followers see your Lists and profile reviews.",
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
