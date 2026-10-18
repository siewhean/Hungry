import { useEffect, useState } from "react";
import { BellPlus, BellRing } from "lucide-react-native";

import { Button } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { registerForStallAlerts } from "@/lib/notifications/push";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

/**
 * On a first follow, turn stall alerts on right away: ask for push permission
 * (only prompts if not yet granted), register this device and save the
 * preference. Returns whether alerts are on.
 */
async function enableStallAlertsOnFirstFollow(): Promise<boolean> {
  const preferences = await getHungryService().push.getPreferences();
  if (preferences.stallUpdates) return true;
  if (!(await registerForStallAlerts())) return false;
  await getHungryService().push.updatePreferences({ stallUpdates: true });
  trackAnalyticsEvent("notification_preferences_updated", {
    stall_updates: true,
    source: "first_follow",
  });
  return true;
}

interface FollowStallButtonProps {
  stallId: string;
  stallName: string;
}

/** Follow a stall to get opt-in alerts when its menu changes. Signed-in users only. */
export function FollowStallButton({ stallId, stallName }: FollowStallButtonProps) {
  const { palette } = useHungryTheme();
  const isLoaded = useStallFollowStore((state) => state.isLoaded);
  const isFollowing = useStallFollowStore((state) => state.followedStallIds.includes(stallId));
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const toggleFollow = useStallFollowStore((state) => state.toggleFollow);
  const showToast = useUIStore((state) => state.showToast);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      void loadFollowedStalls().catch(() => {});
    }
  }, [isLoaded, loadFollowedStalls]);

  const handlePress = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      const isFirstFollow = useStallFollowStore.getState().followedStallIds.length === 0;
      const following = await toggleFollow(stallId);
      if (!following) {
        showToast({ message: `Stopped following ${stallName}.`, tone: "success" });
        return;
      }
      if (FEATURE_FLAGS.stallAlertsEnabled && isFirstFollow) {
        const alertsOn = await enableStallAlertsOnFirstFollow().catch(() => false);
        showToast({
          message: alertsOn
            ? `Following ${stallName}. We'll tell you when its menu changes.`
            : `Following ${stallName}. Allow notifications for Hungry in your phone settings to get alerts.`,
          tone: "success",
        });
        return;
      }
      showToast({
        message: `Following ${stallName}. Turn on stall updates in Settings to get alerts.`,
        tone: "success",
      });
    } catch {
      showToast({ message: "Couldn't update follow. Please try again.", tone: "error" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      label={isFollowing ? "Following" : "Follow for menu updates"}
      variant={isFollowing ? "ghost" : "secondary"}
      accessibilityLabel={isFollowing ? `Unfollow ${stallName}` : `Follow ${stallName}`}
      leftIcon={
        isFollowing ? (
          <BellRing size={18} color={palette.orange} />
        ) : (
          <BellPlus size={18} color={palette.text} />
        )
      }
      onPress={() => void handlePress()}
    />
  );
}
