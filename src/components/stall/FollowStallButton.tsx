import { useEffect, useState } from "react";
import { BellPlus, BellRing } from "lucide-react-native";

import { Button } from "@/components/ui";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

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
      const following = await toggleFollow(stallId);
      showToast({
        message: following
          ? `Following ${stallName}. Turn on stall updates in Settings to get alerts.`
          : `Stopped following ${stallName}.`,
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
