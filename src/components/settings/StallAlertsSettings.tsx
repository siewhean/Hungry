import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import {
  BellOff,
  BellRing,
  RefreshCw,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNotificationPermissionState, registerForStallAlerts } from "@/lib/notifications/push";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
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
} as const;

interface StallAlertsSettingsProps {
  onOpenFollowedStalls: () => void;
}

/**
 * Push alerts: opt-in menu changes at followed stalls and lunch and dinner
 * suggestions (both off until turned on), and the weekly picks push (on unless
 * the user opts out).
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
      .catch(() => {
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
  // comes back from system settings, so a switch never shows "on" while nothing can arrive.
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

  const handleToggle = async (
    key: "stallUpdates" | "weeklyPicks" | "mealtimeSuggestions",
    enabled: boolean,
  ) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (enabled && !(await registerForStallAlerts())) {
        Alert.alert(
          "Notifications are off",
          "Allow notifications for Hungry in your phone settings to get these alerts.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => void Linking.openSettings().catch(() => {}) },
          ],
        );
        return;
      }
      const next = await getHungryService().push.updatePreferences({ [key]: enabled });
      setPreferences(next);
      trackAnalyticsEvent("notification_preferences_updated", {
        [PREFERENCE_EVENT_KEYS[key]]: enabled,
      });
    } catch {
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
          label="Notifications are off for Hungry"
          description="Open settings to turn them on. Until then these alerts can't reach you."
          icon={<BellOff size={20} color={palette.orange} />}
          onPress={() => void Linking.openSettings().catch(() => {})}
          isLast={false}
        />
      ) : null}
      {loadState === "error" ? (
        <SettingsRow
          editorial
          label="Couldn't load your alert settings"
          description="Tap to try again."
          icon={<RefreshCw size={20} color={palette.orange} />}
          onPress={() => loadPreferences()}
          isLast={false}
        />
      ) : null}
      <SettingsRow
        editorial
        label="Menu changes at followed stalls"
        description={`New dishes, price changes and restocks. Quiet ${formatHour(
          preferences.quietStartHour,
        )} to ${formatHour(preferences.quietEndHour)}, at most ${preferences.weeklyCap} a week.`}
        icon={<BellRing size={20} color={palette.orange} />}
        type="toggle"
        isEnabled={preferences.stallUpdates && !permissionDenied}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("stallUpdates", value)}
        isLast={false}
      />
      <SettingsRow
        editorial
        label="Weekly picks"
        description="A Monday nudge when your new dish picks are ready on Home."
        icon={<Sparkles size={20} color={palette.orange} />}
        type="toggle"
        isEnabled={preferences.weeklyPicks && !permissionDenied}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("weeklyPicks", value)}
        isLast={false}
      />
      <SettingsRow
        editorial
        label="Lunch and dinner ideas"
        description="Three picks at 11:30am or 5:30pm, only on days you haven't opened Hungry yet."
        icon={<UtensilsCrossed size={20} color={palette.orange} />}
        type="toggle"
        isEnabled={preferences.mealtimeSuggestions && !permissionDenied}
        dimmed={permissionDenied}
        busy={isBusy}
        onToggle={(value) => void handleToggle("mealtimeSuggestions", value)}
        isLast={false}
      />
      <SettingsRow
        editorial
        label="Followed stalls"
        icon={<Store size={20} color={palette.orange} />}
        type="navigation"
        onPress={onOpenFollowedStalls}
        isLast
      />
    </SettingsSection>
  );
}
