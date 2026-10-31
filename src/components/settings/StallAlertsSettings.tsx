import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getNotificationPermissionState, registerForStallAlerts } from "@/lib/notifications/push";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppSymbol } from "@/components/ui";
import { DEFAULT_PUSH_PREFERENCES, type PushPreferences } from "@/types/domain";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

function formatHour(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

const PREFERENCE_EVENT_KEYS = {
  stallUpdates: "stall_updates",
  weeklyPicks: "weekly_picks",
  mealtimeSuggestions: "mealtime_suggestions",
  socialActivity: "social_activity",
} as const;

type PreferenceKey = keyof typeof PREFERENCE_EVENT_KEYS;

interface StallAlertsSettingsProps {
  onOpenFollowedStalls: () => void;
}

/**
 * Push alerts: opt-in menu changes at followed stalls and lunch and dinner
 * suggestions (both off until turned on), and the weekly picks and follow-request
 * pushes (the follow-request one on unless the user opts out). While the phone blocks notifications the
 * switches still show what is saved, dimmed, so a saved alert can be turned off.
 */
export function StallAlertsSettings({ onOpenFollowedStalls }: StallAlertsSettingsProps) {
  const { palette } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  // Switches stay disabled until the saved preferences load, so defaults are never shown as truth.
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");

  const loadPreferences = useCallback((isCancelled: () => boolean = () => false) => {
    setLoadState("loading");
    getHungryService()
      .push.getPreferences()
      .then((next) => {
        if (isCancelled()) return;
        setPreferences(next);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        reportError(error, { area: "stall_alerts_settings_load" });
        if (!isCancelled()) setLoadState("error");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPreferences(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadPreferences]);

  // The phone's permission can be off or revoked later; read it on open and when the app
  // comes back from system settings, so the "Notifications are off" row explains why
  // nothing can arrive.
  const [permissionDenied, setPermissionDenied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const checkPermission = () => {
      getNotificationPermissionState()
        .then((state) => {
          if (!cancelled) setPermissionDenied(state === "denied");
        })
        .catch(() => undefined);
    };
    checkPermission();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") checkPermission();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const isBusy = loadState !== "loaded" || isSaving;

  const handleToggle = async (key: PreferenceKey, enabled: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (enabled && !(await registerForStallAlerts())) {
        // The "Notifications are off for Hungry" row below opens the phone's settings.
        setPermissionDenied(true);
        showToast({
          message: "Allow notifications for Hungry in your phone settings to get these alerts.",
          tone: "warning",
        });
        return;
      }
      const next = await getHungryService().push.updatePreferences({ [key]: enabled });
      setPreferences(next);
      trackAnalyticsEvent("notification_preferences_updated", {
        [PREFERENCE_EVENT_KEYS[key]]: enabled,
      });
    } catch (error) {
      reportError(error, { area: "stall_alerts_settings_update", preference: key });
      showToast({ message: "Couldn't update alerts. Please try again.", tone: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection editorial title="Notifications">
      {permissionDenied ? (
        <SettingsRow
          editorial
          iconTone="neutral"
          label="Notifications are off for Hungry"
          description="Open settings to turn them on. Until then these alerts can't reach you."
          icon={<AppSymbol name="notificationsOff" size={20} color={palette.textSecondary} />}
          type="action"
          onPress={() => void Linking.openSettings().catch(() => {})}
          isLast={false}
        />
      ) : null}
      {loadState === "error" ? (
        <SettingsRow
          editorial
          iconTone="neutral"
          label="Couldn't load your alert settings"
          description="Tap to try again."
          icon={<AppSymbol name="retry" size={20} color={palette.textSecondary} />}
          type="action"
          onPress={() => loadPreferences()}
          isLast={false}
        />
      ) : null}
      {FEATURE_FLAGS.stallFollowEnabled ? (
        <SettingsRow
          editorial
          iconTone="neutral"
          label="Menu changes at followed stalls"
          description={`New dishes, price changes and restocks. Quiet ${formatHour(
            preferences.quietStartHour,
          )} to ${formatHour(preferences.quietEndHour)}, at most ${preferences.weeklyCap} a week.`}
          icon={<AppSymbol name="menuChanges" size={20} color={palette.textSecondary} />}
          type="toggle"
          isEnabled={preferences.stallUpdates}
          dimmed={permissionDenied}
          busy={isBusy}
          onToggle={(value) => void handleToggle("stallUpdates", value)}
          isLast={false}
        />
      ) : null}
      <SettingsRow
        editorial
        iconTone="neutral"
        label="Weekly picks"
        description="A Monday nudge when your new dish picks are ready on Home."
        icon={<AppSymbol name="weeklyPicks" size={20} color={palette.textSecondary} />}
        type="toggle"
        isEnabled={preferences.weeklyPicks}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("weeklyPicks", value)}
        isLast={false}
      />
      <SettingsRow
        editorial
        iconTone="neutral"
        label="Lunch and dinner ideas"
        description="Three picks at 11:30am or 5:30pm, only on days you haven't opened Hungry yet."
        icon={<AppSymbol name="mealIdeas" size={20} color={palette.textSecondary} />}
        type="toggle"
        isEnabled={preferences.mealtimeSuggestions}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("mealtimeSuggestions", value)}
        isLast={false}
      />
      <SettingsRow
        editorial
        iconTone="neutral"
        label="Follow requests"
        description="When someone asks to follow your private profile."
        icon={<AppSymbol name="followRequests" size={20} color={palette.textSecondary} />}
        type="toggle"
        isEnabled={preferences.socialActivity}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("socialActivity", value)}
        isLast={!FEATURE_FLAGS.stallFollowEnabled}
      />
      {FEATURE_FLAGS.stallFollowEnabled ? (
        <SettingsRow
          editorial
          iconTone="neutral"
          label="Followed stalls"
          icon={<AppSymbol name="followedStalls" size={20} color={palette.textSecondary} />}
          type="navigation"
          onPress={onOpenFollowedStalls}
          isLast
        />
      ) : null}
    </SettingsSection>
  );
}
