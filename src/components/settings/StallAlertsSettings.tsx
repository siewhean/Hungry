import { useEffect, useState } from "react";
import { BellRing, Store } from "lucide-react-native";

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

/** Opt-in alerts for verified menu changes at followed stalls. Off until the user turns it on. */
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

  const handleToggle = async (enabled: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (enabled && !(await registerForStallAlerts())) {
        showToast({
          message: "Allow notifications for Hungry in your phone settings to get stall alerts.",
          tone: "error",
        });
        return;
      }
      const next = await getHungryService().push.updatePreferences({ stallUpdates: enabled });
      setPreferences(next);
      trackAnalyticsEvent("notification_preferences_updated", { stall_updates: enabled });
    } catch {
      showToast({ message: "Couldn't update stall alerts. Please try again.", tone: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection title="Stall alerts">
      <SettingsRow
        label="Menu changes at followed stalls"
        description={`New dishes, price changes and restocks. Quiet ${formatHour(
          preferences.quietStartHour,
        )} to ${formatHour(preferences.quietEndHour)}, at most ${preferences.weeklyCap} a week.`}
        icon={<BellRing size={20} color={palette.orange} />}
        type="toggle"
        isEnabled={preferences.stallUpdates}
        onToggle={(value) => void handleToggle(value)}
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
