/**
 * StallInteractionBar — Save / Visited / Add to List actions for a stall.
 *
 * Mounted inside StallDetailScreen. Uses useStallInteractionStore (which awards Food Cred).
 * Save and Visited both toggle. Marking Visited is one tap and never leaves the page; Food
 * Cred for it is paid by the server only once a review exists, so a diner who has not
 * reviewed here gets "Marked as visited" and the screen's optional "What did you have?".
 * The buttons wait for the user's saved stalls to load, so a stall they already saved
 * or visited never shows "Save" again.
 */

import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AddToListSymbol,
  BookmarkSymbol,
  ShareSymbol,
  TriedOffSymbol,
  TriedOnSymbol,
} from "@/components/dish/dishSymbols";
import { DirectionsSymbol, WriteReviewSymbol } from "@/components/stall/stallSymbols";
import { confirmHaptic, tapHaptic } from "@/lib/haptics";

import { useHungryTheme } from "@/theme";
import { DetailActionBar, type DetailAction } from "@/components/detail/DetailActionBar";
import { AppText } from "@/components/ui/AppText";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";

interface StallInteractionBarProps {
  userId: string;
  stallId: string;
  /** False for guests: the same buttons show, and a tap goes through onRequireAuth. */
  isAuthenticated?: boolean;
  /** `action` says what the guest tapped, so the screen can finish it after sign-in. */
  onRequireAuth?: (message: string, action: "save" | "tried") => void;
  /**
   * True when the diner has tried or reviewed a dish here. When false the Food Cred request
   * for the visit is left out (it would pay nothing); when true the server decides.
   */
  hasReviewedDishAtVenue?: boolean;
  /** Called after a stall is newly marked visited (not when it is cleared). */
  onVisited?: () => void;
  /** Called after the stall is saved (not when it is unsaved). */
  onSaved?: () => void;
  /** Called when user taps "Add to list" — saves the stall to the user's Lists (portfolios). */
  onAddToList?: () => void;
  isAddingToList?: boolean;
  /**
   * "card" is the in-page row (Save, Visited, Add to List). "sticky" is the bottom bar with
   * Directions, Visited and Save; holding Save offers Saved stalls and Save to a collection.
   */
  layout?: "card" | "sticky";
  /** Card layout only: leave Save out when the sticky bar already carries it. */
  hideSave?: boolean;
  onShare?: () => void;
  onDirections?: () => void;
  /** Sticky layout only: the orange "Write a review" button. */
  onReview?: () => void;
  /** Sticky layout only: offer "Mark visited" in the hold menu. */
  showVisited?: boolean;
}

export function StallInteractionBar({
  userId,
  stallId,
  isAuthenticated = true,
  onRequireAuth,
  hasReviewedDishAtVenue,
  onVisited,
  onSaved,
  onAddToList,
  isAddingToList = false,
  layout = "card",
  hideSave = false,
  onShare,
  onDirections,
  onReview,
  showVisited = true,
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
  // stall_bar_cta_v1: only users who see a sticky bar with both Directions and Review take part.
  const ctaVariant = useExperimentVariant("stall_bar_cta_v1", {
    enabled: layout === "sticky" && Boolean(onDirections) && Boolean(onReview),
  });

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
      onRequireAuth?.("Sign in to save this stall.", "save");
      return;
    }
    if (!isLoaded) {
      void loadSavedState(true);
      return;
    }
    if (savingInProgress) return;
    setSavingInProgress(true);
    try {
      await toggleSaved(userId, stallId);
      // The sticky bar plays its own confirm; the in-page card needs one here.
      if (layout === "card" && !isSaved) confirmHaptic();
      if (!isSaved) {
        onSaved?.();
        showToast({
          message: "Saved. Find it in Profile, Saved, Stalls.",
          tone: "success",
          // Longer when there is something to press.
          duration: onAddToList ? 5000 : 3000,
          action: onAddToList ? { label: "Add to a list", onPress: onAddToList } : undefined,
        });
        // Missions are extra: a failure there must not say the save failed.
        void incrementProgress(userId, "save_stalls").catch((error) =>
          reportError(error, { component: "StallInteractionBar", action: "mission_save_stalls" }),
        );
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
      onRequireAuth?.("Sign in to mark this stall visited.", "tried");
      return;
    }
    if (!isLoaded) {
      void loadSavedState(true);
      return;
    }
    if (tryingInProgress) return;
    setTryingInProgress(true);
    try {
      const triedResult = await markTried(userId, stallId, "StallDetail", {
        skipPoints: !(hasReviewedDishAtVenue ?? false),
      });
      if (triedResult.isTried) {
        // Missions pay Food Cred, so they keep the old bar: a visit counts once a dish here
        // has been tried or reviewed.
        if (hasReviewedDishAtVenue) {
          void incrementProgress(userId, "mark_tried").catch((error) =>
            reportError(error, { component: "StallInteractionBar", action: "mission_mark_tried" }),
          );
        }
        showToast({ message: "Marked as visited", tone: "success", duration: 3000 });
        onVisited?.();
      } else {
        showToast({ message: "Removed from visited", tone: "info", duration: 3000 });
      }

      if (triedResult.isTried) confirmHaptic();
      else tapHaptic();
    } catch {
      showToast({ message: "Couldn't update your visited stalls. Try again.", tone: "error" });
    } finally {
      if (isMounted.current) setTryingInProgress(false);
    }
  }

  if (layout === "sticky") {
    const interactionLoading = !isLoaded && isLoadingInteractions;
    // directions_cta (stall_bar_cta_v1) swaps the two: Directions is the orange button and
    // Review is an icon. The variant is only ever set when both exist.
    const swapped =
      ctaVariant === "directions_cta" && onDirections && onReview
        ? { directions: onDirections, review: onReview }
        : null;
    // Directions, Share and Visited are taps; holding Save offers a collection.
    const stickyActions: DetailAction[] = [
      ...(swapped
        ? [
            {
              id: "review",
              label: "Review",
              icon: WriteReviewSymbol,
              onPress: swapped.review,
              accessibilityLabel: "Write a review",
            },
          ]
        : onDirections
          ? [
              {
                id: "directions",
                label: "Directions",
                icon: DirectionsSymbol,
                onPress: onDirections,
                accessibilityLabel: "Directions to this stall",
              },
            ]
          : []),
      ...(onShare
        ? [
            {
              id: "share",
              label: "Share",
              icon: ShareSymbol,
              onPress: onShare,
              accessibilityLabel: "Share stall",
            },
          ]
        : []),
      ...(showVisited
        ? [
            {
              id: "tried",
              label: isTried ? "Visited" : "Mark visited",
              caption: "Visited",
              icon: isTried ? TriedOnSymbol : TriedOffSymbol,
              active: isTried,
              role: "checkbox" as const,
              loading: tryingInProgress || interactionLoading,
              onPress: () => void handleTried(),
              accessibilityLabel: isTried ? "Visited" : "Mark this stall visited",
            },
          ]
        : []),
      {
        id: "save",
        label: isSaved ? "Saved" : "Save",
        icon: BookmarkSymbol,
        active: isSaved,
        fillWhenActive: true,
        loading: savingInProgress || interactionLoading,
        onPress: () => void handleSave(),
        accessibilityLabel: isSaved ? "Saved" : "Save this stall",
        ...(onAddToList
          ? {
              holdTitle: "Save to",
              holdOptions: [
                {
                  id: "saved-stalls",
                  // The row toggles, so when it is saved it says what a press does.
                  label: isSaved ? "Remove from saved" : "Saved stalls",
                  icon: BookmarkSymbol,
                  onPress: () => void handleSave(),
                },
                {
                  id: "collection",
                  label: isAddingToList ? "Adding..." : "Save to a collection",
                  icon: AddToListSymbol,
                  onPress: onAddToList,
                },
              ],
            }
          : {}),
      },
    ];
    return (
      <DetailActionBar
        actions={stickyActions}
        cta={
          swapped
            ? {
                label: "Directions",
                icon: DirectionsSymbol,
                onPress: swapped.directions,
                accessibilityLabel: "Directions to this stall",
              }
            : onReview
              ? { label: "Write a review", onPress: onReview }
              : undefined
        }
        testID="stall-action-bar"
      />
    );
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
    ...(hideSave
      ? []
      : [
          {
            id: "save",
            label: isSaved ? "Saved" : "Save",
            icon: BookmarkSymbol,
            active: isSaved,
            onPress: handleSave,
            loading: savingInProgress || (!isLoaded && isLoadingInteractions),
          },
        ]),
    {
      id: "tried",
      label: isTried ? "Visited" : "Mark visited",
      icon: TriedOnSymbol,
      active: isTried,
      onPress: handleTried,
      loading: tryingInProgress || (!isLoaded && isLoadingInteractions),
    },
    ...(onAddToList
      ? [
          {
            id: "list",
            label: "Add to list",
            icon: AddToListSymbol,
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
