import { useEffect, useState } from "react";
import { BellRing, Sparkles, Store } from "lucide-react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { registerForStallAlerts } from "@/lib/notifications/push";
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
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getHungryService()
      .push.getPreferences()
      .then((next) => {
        if (!cancelled) setPreferences(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (key: "stallUpdates" | "weeklyPicks", enabled: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (enabled && !(await registerForStallAlerts())) {
        showToast({
          message: "Allow notifications for Hungry in your phone settings to get these alerts.",
          tone: "error",
        });
        return;
      }
      const next = await getHungryService().push.updatePreferences({ [key]: enabled });
      setPreferences(next);
      trackAnalyticsEvent(
        "notification_preferences_updated",
        key === "stallUpdates" ? { stall_updates: enabled } : { weekly_picks: enabled },
      );
    } catch {
      showToast({ message: "Couldn't update alerts. Please try again.", tone: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection title="Alerts">
      <SettingsRow
        label="Menu changes at followed stalls"
        description={`New dishes, price changes and restocks. Quiet ${formatHour(
          preferences.quietStartHour,
        )} to ${formatHour(preferences.quietEndHour)}, at most ${preferences.weeklyCap} a week.`}
        icon={<BellRing size={20} color={palette.orange} />}
        type="toggle"
        isEnabled={preferences.stallUpdates}
        onToggle={(value) => void handleToggle("stallUpdates", value)}
        isLast={false}
      />
      <SettingsRow
        label="Weekly picks"
        description="A Monday nudge when your new dish picks are ready on Home."
        icon={<Sparkles size={20} color={palette.orange} />}
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
