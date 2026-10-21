/**
 * StallInteractionBar — Save / Visited / Add to List actions for a stall.
 *
 * Mounted inside StallDetailScreen. Uses useStallInteractionStore + useFoodCredStore.
 * Save and Visited both toggle. Marking Visited needs a tried or reviewed dish from
 * this stall first (the same rule the dish page's "Tried" feeds); clearing it never does.
 * The buttons wait for the user's saved stalls to load, so a stall they already saved
 * or visited never shows "Save" again.
 */

import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** False for guests: the same buttons show, and a tap goes through onRequireAuth. */
  isAuthenticated?: boolean;
  onRequireAuth?: (message: string) => void;
  reviewPromptText?: string;
  hasReviewedDishAtVenue?: boolean;
  onReviewRequired?: () => void;
  /** Called after the stall is saved (not when it is unsaved). */
  onSaved?: () => void;
  /** Called when user taps "Add to List" — saves the stall to the user's Lists (portfolios). */
  onAddToList?: () => void;
  isAddingToList?: boolean;
}

export function StallInteractionBar({
  userId,
  stallId,
  isAuthenticated = true,
  onRequireAuth,
  reviewPromptText,
  hasReviewedDishAtVenue,
  onReviewRequired,
  onSaved,
  onAddToList,
  isAddingToList = false,
}: StallInteractionBarProps) {
  const { componentRadii, palette, spacing, typography } = useHungryTheme();
  const interactions = useStallInteractionStore((state) => state.interactions);
  const storeLoaded = useStallInteractionStore((state) => state.isLoaded);
  // Guests have nothing to load.
  const isLoaded = storeLoaded || !isAuthenticated;
  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const interaction = interactions[stallId];
  const toggleSaved = useStallInteractionStore((s) => s.toggleSaved);
  const markTried = useStallInteractionStore((s) => s.markTried);
  const incrementProgress = useMissionStore((s) => s.incrementProgress);

  const isSaved = isAuthenticated && (interaction?.isSaved ?? false);
  const isTried = isAuthenticated && (interaction?.isTried ?? false);

  const [savingInProgress, setSavingInProgress] = useState(false);
  const [tryingInProgress, setTryingInProgress] = useState(false);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const isMounted = useRef(true);
  const showToast = useUIStore((state) => state.showToast);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadSavedState = useCallback(
    async (announceFailure: boolean) => {
      setIsLoadingInteractions(true);
      try {
        await loadInteractions(userId);
      } catch {
        if (announceFailure) {
          showToast({
            message: "Couldn't load your saved stalls. Try again.",
            tone: "error",
            duration: 3000,
          });
        }
      } finally {
        if (isMounted.current) setIsLoadingInteractions(false);
      }
    },
    [loadInteractions, showToast, userId],
  );

  useEffect(() => {
    if (!isLoaded) void loadSavedState(false);
  }, [isLoaded, loadSavedState]);

  async function handleSave() {
    if (!isAuthenticated) {
      onRequireAuth?.("Sign in to save this stall.");
      return;
    }
    if (!isLoaded) {
      void loadSavedState(true);
      return;
    }
    if (savingInProgress) return;
    setSavingInProgress(true);
    try {
      Haptics.selectionAsync();
      await toggleSaved(userId, stallId);
      if (!isSaved) {
        // Just saved (not unsaved) — count toward missions
        onSaved?.();
        await incrementProgress(userId, "save_stalls");
      }
    } catch {
      // The store rolled the button back: say so instead of leaving a silent rejection.
      showToast({ message: "Couldn't update your saved stalls. Try again.", tone: "error" });
    } finally {
      if (isMounted.current) setSavingInProgress(false);
    }
  }

  async function handleTried() {
    if (!isAuthenticated) {
      onRequireAuth?.("Sign in to mark this stall visited.");
      return;
    }
    if (!isLoaded) {
      void loadSavedState(true);
      return;
    }
    if (tryingInProgress) return;
    setTryingInProgress(true);
    try {
      const hasReviewed = hasReviewedDishAtVenue ?? false;
      // The tried-a-dish rule only gates marking; a stall already marked can always be cleared.
      if (!isTried && !hasReviewed) {
        // One toast only: the screen's handler shows its own when it is given.
        if (onReviewRequired) {
          onReviewRequired();
        } else {
          const message =
            reviewPromptText ?? "Try or review a dish here before marking this stall visited.";
          showToast({ message, tone: "warning", duration: 3000 });
        }
        return;
      }

      const triedResult = await markTried(userId, stallId);
      if (triedResult.isTried) {
        await incrementProgress(userId, "mark_tried");
        showToast({ message: "Marked as visited", tone: "success", duration: 3000 });
      } else {
        showToast({ message: "Removed from visited", tone: "info", duration: 3000 });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      showToast({ message: "Couldn't update your visited stalls. Try again.", tone: "error" });
    } finally {
      if (isMounted.current) setTryingInProgress(false);
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
      loading: savingInProgress || (!isLoaded && isLoadingInteractions),
    },
    {
      id: "tried",
      label: isTried ? "Visited" : "Mark Visited",
      icon: CheckCircle,
      active: isTried,
      onPress: handleTried,
      loading: tryingInProgress || (!isLoaded && isLoadingInteractions),
    },
    ...(onAddToList
      ? [
          {
            id: "list",
            label: "Add to List",
            icon: ListPlus,
            active: false,
            onPress: onAddToList,
            loading: isAddingToList,
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
