import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Share, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useShallow } from "zustand/react/shallow";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, Dialog } from "@/components/ui";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { AccountDeletionCodeDialog } from "@/components/settings/AccountDeletionCodeDialog";
import {
  AccountDeletionDialog,
  type DeletionReason,
} from "@/components/settings/AccountDeletionDialog";
import { SettingsProfileCard } from "@/components/settings/SettingsProfileCard";
import { SettingsChoiceSheet } from "@/components/settings/SettingsChoiceSheet";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { foodOpennessLabel } from "@/constants/taste";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { answerAnalyticsConsent, setAiSearchConsent } from "@/features/privacy/consent";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { confirmAction } from "@/lib/runtime/confirmAction";
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
import { useConsentStore } from "@/store/useConsentStore";
import { useUIStore } from "@/store/useUIStore";
import { hungryPersistStorage } from "@/store/persistStorage";
import { PendingDeletionBanner } from "@/features/auth/PendingDeletionBanner";
import { useHungryTheme } from "@/theme";
import { BLOCKED_AND_HIDDEN_TITLE } from "./BlockedAndHiddenScreen";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { SUPPORT_EMAIL, WEB_LINKS } from "@/constants/links";

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

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const rootNavigation = getRootNavigation(navigation);
  const { palette } = useHungryTheme();

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
    hapticFeedbackEnabled,
    setHapticFeedbackEnabled,
    allowSearchHistory,
    setAllowSearchHistory,
    analyticsEnabled,
    leftHandedMode,
    setLeftHandedMode,
    showToast,
  } = useUIStore(
    useShallow((state) => ({
      hapticFeedbackEnabled: state.hapticFeedbackEnabled,
      setHapticFeedbackEnabled: state.setHapticFeedbackEnabled,
      allowSearchHistory: state.allowSearchHistory,
      setAllowSearchHistory: state.setAllowSearchHistory,
      analyticsEnabled: state.analyticsEnabled,
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

  // Neutral grey icons on grey discs; colour is kept for state (error red, accent actions).
  const iconColor = palette.textSecondary;
  const neutralRow = { editorial: true, iconTone: "neutral" } as const;
  const isNative = Platform.OS !== "web";

  // The denominator for every Settings experiment: one view per time the screen comes into focus.
  const isSignedInRef = useRef(isAuthenticated);
  isSignedInRef.current = isAuthenticated;
  useFocusEffect(
    useCallback(() => {
      trackAnalyticsEvent("settings_viewed", { signed_in: isSignedInRef.current });
    }, []),
  );

  const [deletionRequested, setDeletionRequested] = useState(false);
  const [deletionCodeVisible, setDeletionCodeVisible] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const aiSearchAllowed = useConsentStore((state) => state.aiSearchAllowed);
  const [isSavingAiSearch, setIsSavingAiSearch] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  // The optional one-tap reason from the delete dialog, kept for the event sent with the request.
  const deletionReason = useRef<DeletionReason | null>(null);
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
            confirmAction({
              title: "Your export is large",
              message: `Your data is too big to share from the app on this phone. Email ${SUPPORT_EMAIL} and we will send you a copy.`,
              confirmLabel: "Email support",
              onConfirm: () =>
                void openTrustedExternalUrl(
                  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("My Hungry data export")}`,
                ),
            });
          }
        }
      } catch (error) {
        reportError(error, { area: "settings_data_export" });
        trackAnalyticsEvent("settings_data_export_failed", {});
        showToast({
          message: `We could not prepare your data right now. Please try again or email ${SUPPORT_EMAIL}.`,
          tone: "error",
        });
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
    | "contact"
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
      trackAnalyticsEvent("account_deletion_requested", {
        surface: "settings",
        reason_choice: deletionReason.current ?? "none",
      });
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
    confirmAction({
      title: "Couldn't change visibility",
      message: `Your profile is still ${visibility === "private" ? "public" : "private"}. Check your connection and try again.`,
      confirmLabel: "Retry",
      onConfirm: () => void changeProfileVisibility(visibility),
    });
  };

  const openAppSettings = async () => {
    // Web has no phone settings to open; that is not an error worth reporting.
    if (typeof Linking.openSettings !== "function") return;
    try {
      await Linking.openSettings();
    } catch (error) {
      reportError(error, { area: "settings_open_app_settings" });
      showToast({
        message:
          "Couldn't open system settings. You can update permissions from your device settings app.",
        tone: "warning",
      });
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
      confirmAction({
        title: "Location permissions",
        message:
          "Hungry could not enable location access. Update this permission in Settings if you previously denied it.",
        confirmLabel: "Open settings",
        onConfirm: () => void openAppSettings(),
      });
    }
  };

  // Turning it off sends nothing (not even this change); turning it on says so. Saved on the
  // account too, so the choice follows the person to another phone.
  const handleAnalyticsToggle = (enabled: boolean) => {
    void answerAnalyticsConsent(enabled);
  };

  // Saved on the account before the switch moves, so it never shows "allowed" for a choice the
  // server does not have.
  const handleAiSearchToggle = (allowed: boolean) => {
    setIsSavingAiSearch(true);
    void setAiSearchConsent(allowed)
      .then(() => trackAnalyticsEvent("settings_changed", { setting: "ai_search", value: allowed }))
      .catch((error: unknown) => {
        reportError(error, { area: "settings_ai_search_consent" });
        showToast({
          message: "Couldn't save that. Check your connection and try again.",
          tone: "error",
        });
      })
      .finally(() => setIsSavingAiSearch(false));
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
    confirmAction({
      title: "Reset food history",
      message:
        "Recommendations will forget your dish history: the dishes you liked, tapped or hid. Your taste profile, favourites and reviews stay.",
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: () => {
        void resetFoodHistory()
          .then(() =>
            showToast({
              message: "Food history reset. Recommendations start fresh.",
              tone: "success",
            }),
          )
          .catch((error: unknown) => {
            reportError(error, { area: "settings_reset_food_history" });
            showToast({
              message: "Couldn't reset. Check your connection and try again.",
              tone: "error",
            });
          });
      },
    });
  };

  const handleResetLocation = () => {
    confirmAction({
      title: "Reset selected location",
      message:
        "This clears the area you picked. Hungry will use your device location when location access is allowed.",
      confirmLabel: "Reset",
      onConfirm: () => {
        void clearManualLocation()
          .then(() =>
            showToast({ message: "Your selected location has been cleared.", tone: "success" }),
          )
          .catch((error: unknown) => {
            reportError(error, { area: "settings_reset_location" });
            showToast({
              message: "Couldn't reset your location. Please try again.",
              tone: "error",
            });
          });
      },
    });
  };

  const handleClearLocalData = () => {
    confirmAction({
      title: "Clear local cache",
      message:
        "This removes recent searches, unsent review drafts, cached images and any saved data export on this device. You stay signed in.",
      confirmLabel: "Clear",
      onConfirm: () => {
        void (async () => {
          try {
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
            showToast({
              message: "Local cache cleared. Searches, drafts and cached images were removed.",
              tone: "success",
            });
          } catch (error) {
            reportError(error, { area: "settings_clear_local_cache" });
            showToast({ message: "Couldn't clear the cache. Please try again.", tone: "error" });
          }
        })();
      },
    });
  };

  const handleSignOut = () => setAccountDialog("signOut");

  const runSignOut = () => {
    // useSessionStore.signOut clears every account-scoped store (search, review
    // draft, location, social, profile) so all sign-out entry points match.
    signOut();
    resetToLogin();
  };

  const handleSignOutEverywhere = () => {
    confirmAction({
      title: "Sign out of all devices",
      message: "This signs you out of Hungry on every phone, including this one.",
      confirmLabel: "Sign out everywhere",
      destructive: true,
      onConfirm: () => {
        // Supabase answers a global sign-out with SIGNED_OUT; that is not an expired session.
        expectSignOut();
        // Set first: Login may mount on that SIGNED_OUT, before the call below resolves.
        setAuthNotice({ message: "Signed out of all devices.", tone: "success" });
        void getHungryService()
          .auth.signOut({ scope: "global" })
          .then(() => {
            signOut();
            resetToLogin();
          })
          .catch((error: unknown) => {
            setAuthNotice(null);
            reportError(error, { area: "settings_sign_out_everywhere" });
            showToast({
              message: "Couldn't sign out everywhere. Check your connection and try again.",
              tone: "error",
            });
          });
      },
    });
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

      {isAuthenticated ? (
        <SettingsProfileCard
          name={profile.displayName}
          email={profile.email}
          avatarUrl={profile.avatarUrl}
          onPress={() => navigation.navigate("EditProfile")}
        />
      ) : null}

      <SettingsSection
        // Remount when the variant resolves after flags load, so the fold state follows it.
        key={`dining-${diningVariant}`}
        editorial
        collapsible
        defaultCollapsed={diningVariant === "control"}
        title="Your taste"
        collapsedSummary={diningSummary}
      >
        <SettingsRow
          {...neutralRow}
          label="Dietary preferences"
          description="Choose the dietary flags used for your recommendations."
          icon={<AppSymbol name="dietary" size={20} color={iconColor} />}
          type="navigation"
          value={
            profile.dietaryPreferences.length
              ? `${profile.dietaryPreferences.length} selected`
              : "None selected"
          }
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "dietary", source: "settings" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Flavour profile"
          description="Review the taste answers behind your recommendations."
          icon={<AppSymbol name="flavourProfile" size={20} color={iconColor} />}
          type="navigation"
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "taste", source: "settings" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Meal budget"
          icon={<AppSymbol name="mealBudget" size={20} color={iconColor} />}
          type="navigation"
          value={profile.maxDishBudget ? `Up to S$${profile.maxDishBudget}` : "Not set"}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile", initialPhase: "budget", source: "settings" },
            })
          }
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Trying new food"
          icon={<AppSymbol name="tryingNewFood" size={20} color={iconColor} />}
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
            {...neutralRow}
            label="Reset food history"
            icon={<AppSymbol name="foodHistory" size={20} color={iconColor} />}
            type="action"
            onPress={handleResetFoodHistory}
            isLast
          />
        ) : null}
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

      <SettingsSection editorial title="Privacy & data">
        {isAuthenticated ? (
          <SettingsRow
            {...neutralRow}
            label="Profile visibility"
            icon={
              <AppSymbol
                name={isProfilePrivate ? "profilePrivate" : "profilePublic"}
                size={20}
                color={iconColor}
              />
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
            {...neutralRow}
            label={BLOCKED_AND_HIDDEN_TITLE}
            icon={<AppSymbol name="blocked" size={20} color={iconColor} />}
            type="navigation"
            onPress={() => rootNavigation.navigate("BlockedAndHidden")}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          {...neutralRow}
          label="Share usage analytics"
          description="Helps us see what to fix. Crash reports are still sent."
          icon={<AppSymbol name="analytics" size={20} color={iconColor} />}
          type="toggle"
          isEnabled={analyticsEnabled}
          onToggle={handleAnalyticsToggle}
          isLast={false}
        />
        {isAuthenticated ? (
          <SettingsRow
            {...neutralRow}
            label="AI features"
            description="Lets Hungry send the words you type in search to Anthropic, and a menu photo you add to Google, so they can be understood and read. Your name and account details are not sent."
            icon={<AppSymbol name="aiSearch" size={20} color={iconColor} />}
            type="toggle"
            isEnabled={aiSearchAllowed}
            busy={isSavingAiSearch}
            onToggle={handleAiSearchToggle}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          {...neutralRow}
          label="Allow search history"
          icon={<AppSymbol name="foodHistory" size={20} color={iconColor} />}
          type="toggle"
          isEnabled={allowSearchHistory}
          onToggle={handleSearchHistoryToggle}
          isLast={false}
        />
        {isNative ? (
          <SettingsRow
            {...neutralRow}
            label="Location permission"
            icon={<AppSymbol name="location" size={20} color={iconColor} />}
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
        ) : null}
        <SettingsRow
          {...neutralRow}
          label="Reset selected location"
          icon={<AppSymbol name="resetLocation" size={20} color={iconColor} />}
          type="action"
          onPress={handleResetLocation}
          isLast={false}
        />
        {isNative ? (
          <SettingsRow
            {...neutralRow}
            label="Phone permissions"
            icon={<AppSymbol name="phonePermissions" size={20} color={iconColor} />}
            onPress={openAppSettings}
            value="Open settings"
            isLast={false}
          />
        ) : null}
        {isAuthenticated ? (
          <SettingsRow
            {...neutralRow}
            label={isExportingData ? "Preparing your data…" : "Download my data"}
            icon={<AppSymbol name="downloadData" size={20} color={iconColor} />}
            type="action"
            onPress={handleExportData}
            busy={isExportingData}
            isLast={false}
          />
        ) : null}
        <SettingsRow
          {...neutralRow}
          label="Clear local cache"
          icon={<AppSymbol name="clearCache" size={20} color={iconColor} />}
          type="action"
          onPress={handleClearLocalData}
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="How account deletion works"
          icon={<AppSymbol name="accountDeletionInfo" size={20} color={iconColor} />}
          type="link"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.accountDeletion)}
          isLast
        />
      </SettingsSection>

      {isAuthenticated ? (
        <SettingsSection editorial title="Account & security">
          {canChangePassword ? (
            <SettingsRow
              {...neutralRow}
              label="Change password"
              icon={<AppSymbol name="changePassword" size={20} color={iconColor} />}
              onPress={() => rootNavigation.navigate("ChangePassword")}
              isLast={false}
            />
          ) : null}
          <SettingsRow
            {...neutralRow}
            label="Sign out of all devices"
            description="Ends your Hungry session on every phone, including this one."
            icon={<AppSymbol name="signOutEverywhere" size={20} color={iconColor} />}
            type="action"
            onPress={handleSignOutEverywhere}
            isLast={deletionPending}
          />
          {/* While a request is pending, Keep my account (top) is the action; no second request. */}
          {deletionPending ? null : (
            <SettingsRow
              {...neutralRow}
              label="Delete account"
              icon={<AppSymbol name="deleteAccount" size={20} color={palette.error} />}
              type="action"
              destructive
              busy={deletionRequested}
              onPress={handleDeleteAccount}
              isLast
            />
          )}
        </SettingsSection>
      ) : null}

      <SettingsSection editorial title="On this phone">
        <SettingsRow
          {...neutralRow}
          label="Haptic feedback"
          icon={<AppSymbol name="haptics" size={20} color={iconColor} />}
          type="toggle"
          isEnabled={hapticFeedbackEnabled}
          onToggle={handleDeviceToggle("haptic_feedback", setHapticFeedbackEnabled)}
          isLast={!hasMerchantAccount}
        />
        {hasMerchantAccount ? (
          <SettingsRow
            {...neutralRow}
            label="Left-handed mode"
            description="Moves the add button on your merchant menu to the left side."
            icon={<AppSymbol name="leftHanded" size={20} color={iconColor} />}
            type="toggle"
            isEnabled={leftHandedMode}
            onToggle={handleDeviceToggle("left_handed_mode", setLeftHandedMode)}
            isLast
          />
        ) : null}
      </SettingsSection>

      <SettingsSection editorial title="Help & legal">
        <SettingsRow
          {...neutralRow}
          label="Contact us"
          description="Email us or open the help centre."
          icon={<AppSymbol name="contact" size={20} color={iconColor} />}
          type="action"
          onPress={() => setAccountDialog("contact")}
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Privacy policy"
          type="link"
          icon={<AppSymbol name="privacyPolicy" size={20} color={iconColor} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Terms of service"
          type="link"
          icon={<AppSymbol name="legal" size={20} color={iconColor} />}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Open-source data"
          icon={<AppSymbol name="openData" size={20} color={iconColor} />}
          type="value"
          description="Venue details include data © OpenStreetMap contributors (ODbL), Overture Maps Foundation and Foursquare Open Source Places."
          isLast={false}
        />
        <SettingsRow
          {...neutralRow}
          label="Version"
          icon={<AppSymbol name="version" size={20} color={iconColor} />}
          type="value"
          value={appVersion}
          description="Tap to copy."
          onPress={handleCopyVersion}
          onLongPress={handleCopyVersion}
          isLast
        />
      </SettingsSection>

      {isAuthenticated ? (
        <SettingsSection editorial>
          <SettingsRow
            {...neutralRow}
            label="Sign out"
            icon={<AppSymbol name="signOut" size={20} color={palette.error} />}
            type="action"
            onPress={handleSignOut}
            destructive
            isLast
          />
        </SettingsSection>
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
        visible={accountDialog === "contact"}
        title="Contact us"
        message={`Email ${SUPPORT_EMAIL}, or find answers in the help centre.`}
        buttons={[
          {
            text: "Email us",
            style: "default",
            onPress: () => void openTrustedExternalUrl(`mailto:${SUPPORT_EMAIL}`),
          },
          {
            text: "Help centre",
            style: "default",
            onPress: () => void openTrustedExternalUrl(WEB_LINKS.help),
          },
          { text: "Cancel", style: "cancel" },
        ]}
        onClose={() => setAccountDialog((current) => (current === "contact" ? null : current))}
      />
      <AccountDeletionDialog
        visible={accountDialog === "deleteAccount"}
        message={`Your profile is hidden straight away, and your account and personal data will be deleted in ${ACCOUNT_DELETION_GRACE_DAYS} days. To keep your account, sign in before then and choose Keep my account. After that, deletion is permanent. Menu photos you shared stay on the stall without your name, and some security, moderation, or legal records may remain in anonymized form.`}
        onDownloadData={handleExportData}
        isDownloading={isExportingData}
        onContinue={(reason) => {
          deletionReason.current = reason;
          setAccountDialog(null);
          void sendDeletionCode();
        }}
        onCancel={() => setAccountDialog(null)}
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
