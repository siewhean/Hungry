/**
 * StallInteractionBar — Save / Visited / Add to Collection actions for a stall.
 *
 * Mounted inside StallDetailScreen. Uses useStallInteractionStore + useFoodCredStore.
 * Each action is idempotent (tried cannot be un-tried in Phase 1).
 */

import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Bookmark, CheckCircle, ListPlus } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { useMissionStore } from "@/store/useMissionStore";

interface StallInteractionBarProps {
  userId: string;
  stallId: string;
  reviewPromptText?: string;
  hasReviewedDishAtVenue?: boolean;
  onReviewRequired?: () => void;
  /** Called when user taps "Add to Collection" — parent handles sheet/modal */
  onAddToCollection?: () => void;
}

export function StallInteractionBar({
  userId,
  stallId,
  onAddToCollection,
}: StallInteractionBarProps) {
  const { componentRadii, palette, spacing, typography } = useHungryTheme();
  const interactions = useStallInteractionStore((state) => state.interactions);
  const interaction = interactions[stallId];
  const toggleSaved = useStallInteractionStore((s) => s.toggleSaved);
  const setVisited = useStallInteractionStore((s) => s.setVisited);
  const incrementProgress = useMissionStore((s) => s.incrementProgress);

  const isSaved = interaction?.isSaved ?? false;
  const isTried = interaction?.isTried ?? false;

  const [savingInProgress, setSavingInProgress] = useState(false);
  const [tryingInProgress, setTryingInProgress] = useState(false);
  const showToast = useUIStore((state) => state.showToast);

  async function handleSave() {
    if (savingInProgress) return;
    setSavingInProgress(true);
    try {
      Haptics.selectionAsync();
      await toggleSaved(userId, stallId);
      if (!isSaved) {
        // Just saved (not unsaved) — count toward missions
        await incrementProgress(userId, "save_stalls");
      }
    } catch {
      showToast({ message: "Could not confirm this change. Please try again.", tone: "error" });
    } finally {
      setSavingInProgress(false);
    }
  }

  async function handleTried() {
    if (tryingInProgress) return;
    setTryingInProgress(true);
    try {
      const visited = await setVisited(userId, stallId, !isTried);
      showToast({ message: visited ? "Visited this stall" : "Visit removed", tone: "success" });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      showToast({ message: "Could not confirm this change. Please try again.", tone: "error" });
    } finally {
      setTryingInProgress(false);
    }
  }

  const actions: {
    id: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
  }[] = [
    {
      id: "save",
      label: isSaved ? "Saved" : "Save",
      icon: Bookmark,
      active: isSaved,
      onPress: handleSave,
      loading: savingInProgress,
    },
    {
      id: "tried",
      label: "Visited this stall",
      icon: CheckCircle,
      active: isTried,
      onPress: handleTried,
      loading: tryingInProgress,
    },
    ...(onAddToCollection
      ? [
          {
            id: "collection",
            label: "Add to List",
            icon: ListPlus,
            active: false,
            onPress: onAddToCollection,
          },
        ]
      : []),
  ];

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          gap: 0,
        },
      ]}
    >
      {actions.map((action, idx) => {
        const Icon = action.icon;
        const isFirst = idx === 0;
        const isLast = idx === actions.length - 1;
        return (
          <Pressable
            key={action.id}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            accessibilityState={{ selected: action.active, disabled: action.disabled }}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: action.active
                  ? palette.orangeLight
                  : pressed
                    ? palette.bgSoft
                    : "transparent",
                borderRightColor: !isLast ? palette.border : "transparent",
                borderRightWidth: !isLast ? 1 : 0,
                borderBottomLeftRadius: isFirst ? componentRadii.card : 0,
                borderTopLeftRadius: isFirst ? componentRadii.card : 0,
                borderBottomRightRadius: isLast ? componentRadii.card : 0,
                borderTopRightRadius: isLast ? componentRadii.card : 0,
                paddingVertical: spacing[3],
              },
            ]}
          >
            {action.loading ? (
              <ActivityIndicator size="small" color={palette.orange} />
            ) : (
              <Icon
                size={20}
                color={action.active ? palette.orange : palette.textSecondary}
                fill={action.id === "save" && action.active ? palette.orange : "none"}
              />
            )}
            <AppText
              style={{
                ...typography.micro,
                color: action.active ? palette.orange : palette.textSecondary,
                fontWeight: action.active ? "700" : "400",
                marginTop: 4,
              }}
            >
              {action.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    flexDirection: "row",
    overflow: "hidden",
  },
});
