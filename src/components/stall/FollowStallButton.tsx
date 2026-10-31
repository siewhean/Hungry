import { useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
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
 * Alerts for followed stalls come only from a signed-in merchant editing the menu
 * (Merchant Centre), and catalog imports never alert. Until Merchant Centre ships
 * to production, Follow just feeds Home and Following: no alert promise and no
 * push-permission prompt.
 */
const STALL_ALERTS_CAN_FIRE =
  FEATURE_FLAGS.stallAlertsEnabled && FEATURE_FLAGS.merchantCentreEnabled;

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
  /** False for guests: the button still shows, and a tap goes through onRequireAuth. */
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
  /** Opens Hungry's own Settings screen (stall updates switch). */
  onOpenAppSettings?: () => void;
}

/** Follow a stall (alerts when its menu changes, once owners can edit menus). Guests are sent to sign in. */
export function FollowStallButton({
  stallId,
  stallName,
  isAuthenticated = true,
  onRequireAuth,
  onOpenAppSettings,
}: FollowStallButtonProps) {
  const { palette } = useHungryTheme();
  const isLoaded = useStallFollowStore((state) => state.isLoaded);
  const isFollowing = useStallFollowStore((state) => state.followedStallIds.includes(stallId));
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const toggleFollow = useStallFollowStore((state) => state.toggleFollow);
  const showToast = useUIStore((state) => state.showToast);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isLoaded && isAuthenticated) {
      void loadFollowedStalls().catch(() => {});
    }
  }, [isAuthenticated, isLoaded, loadFollowedStalls]);

  const handlePress = async () => {
    if (isPending) return;
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setIsPending(true);
    try {
      const isFirstFollow = useStallFollowStore.getState().followedStallIds.length === 0;
      const following = await toggleFollow(stallId);
      if (!following) {
        showToast({ message: `Stopped following ${stallName}.`, tone: "success" });
        return;
      }
      if (!STALL_ALERTS_CAN_FIRE) {
        showToast({ message: `Following ${stallName}.`, tone: "success" });
        return;
      }
      if (STALL_ALERTS_CAN_FIRE && isFirstFollow) {
        const alertsOn = await enableStallAlertsOnFirstFollow().catch(() => false);
        if (alertsOn) {
          showToast({
            message: `Following ${stallName}. We'll tell you when its menu changes.`,
            tone: "success",
          });
          return;
        }
        // The fix lives in phone settings, so offer a way there.
        Alert.alert(
          `Following ${stallName}`,
          "Allow notifications for Hungry in your phone settings to get menu alerts.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      if (onOpenAppSettings) {
        Alert.alert(
          `Following ${stallName}`,
          "Turn on stall updates in Settings to get alerts when its menu changes.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: onOpenAppSettings },
          ],
        );
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

  // Follow stall is off for now: no button, nothing to follow.
  if (!FEATURE_FLAGS.stallFollowEnabled) return null;

  return (
    <Button
      label={
        isFollowing ? "Following" : STALL_ALERTS_CAN_FIRE ? "Follow for menu updates" : "Follow"
      }
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
