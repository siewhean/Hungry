import { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { AppText, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { BellRing, Sparkles, Store } from "lucide-react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { registerForStallAlerts } from "@/lib/notifications/push";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { type PushPreferences } from "@/types/domain";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

function formatHour(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

interface StallAlertsSettingsProps {
  onOpenFollowedStalls: () => void;
}

/**
 * Push alerts: opt-in menu changes at followed stalls (off until turned on) and
 * the weekly picks push (on unless the user opts out).
 */
export function StallAlertsSettings({ onOpenFollowedStalls }: StallAlertsSettingsProps) {
  const { palette } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const accountId = useSessionStore((state) => state.authenticatedUserId);
  const generation = useRef(0);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setPreferences(null);
    setLoadError(false);
    setIsSaving(false);
    void getHungryService()
      .push.getPreferences()
      .then((next) => {
        if (!cancelled) setPreferences(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
      generation.current += 1;
    };
  }, [accountId, attempt]);

  const handleToggle = async (key: "stallUpdates" | "weeklyPicks", enabled: boolean) => {
    if (isSaving || !preferences) return;
    const started = generation.current;
    setIsSaving(true);
    try {
      if (enabled && !(await registerForStallAlerts())) {
        if (started === generation.current)
          Alert.alert(
            "Notifications are not enabled",
            "Allow notifications for Hungry in phone settings to receive these alerts.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open settings", onPress: () => void Linking.openSettings() },
            ],
          );
        return;
      }
      const next = await getHungryService().push.updatePreferences({ [key]: enabled });
      if (started !== generation.current) return;
      setPreferences(next);
      trackAnalyticsEvent(
        "notification_preferences_updated",
        key === "stallUpdates" ? { stall_updates: enabled } : { weekly_picks: enabled },
      );
    } catch {
      showToast({ message: "Couldn't update alerts. Please try again.", tone: "error" });
    } finally {
      if (started === generation.current) setIsSaving(false);
    }
  };

  if (!preferences)
    return (
      <SettingsSection title="Alerts">
        {loadError ? (
          <Button
            label="Retry loading alert preferences"
            onPress={() => setAttempt((value) => value + 1)}
          />
        ) : (
          <AppText>Loading alert preferences…</AppText>
        )}
      </SettingsSection>
    );

  return (
    <SettingsSection title="Alerts">
      <SettingsRow
        label="Menu changes at followed stalls"
        description={`New dishes, price changes and restocks. Quiet ${formatHour(
          preferences.quietStartHour,
        )} to ${formatHour(preferences.quietEndHour)}, at most ${preferences.weeklyCap} a week.`}
        icon={<BellRing size={20} color={palette.orange} />}
        disabled={isSaving}
        busy={isSaving}
        type="toggle"
        isEnabled={preferences.stallUpdates}
        onToggle={(value) => void handleToggle("stallUpdates", value)}
        isLast={false}
      />
      <SettingsRow
        label="Weekly picks"
        description="A Monday nudge when your new dish picks are ready on Home."
        icon={<Sparkles size={20} color={palette.orange} />}
        disabled={isSaving}
        busy={isSaving}
        type="toggle"
        isEnabled={preferences.weeklyPicks}
        onToggle={(value) => void handleToggle("weeklyPicks", value)}
        isLast={false}
      />
      <SettingsRow
        label="Followed stalls"
        icon={<Store size={20} color={palette.orange} />}
        type="navigation"
        onPress={onOpenFollowedStalls}
        isLast
      />
    </SettingsSection>
  );
}
