import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View, useWindowDimensions } from "react-native";

import { StarRating, TasteRatingInput } from "@/components/review";
import { AppText, Button } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { TasteKey, TasteVector } from "@/types/domain";

/** How strong each taste felt, in the review editor's 0-10 steps. Axes left out were not rated. */
export type FeltTaste = Partial<Record<TasteKey, number>>;

/** How many taste questions the short popup asks before "More tastes". */
const TOP_TASTE_COUNT = 3;

/** The dish's strongest tastes, strongest first; equal levels keep the list's usual order. */
export function strongestTasteKeys(vector: TasteVector, count = TOP_TASTE_COUNT): TasteKey[] {
  return TASTE_DIMENSIONS.map((dimension, order) => ({
    key: dimension.key,
    level: vector[dimension.key] ?? 0,
    order,
  }))
    .sort((a, b) => b.level - a.level || a.order - b.order)
    .slice(0, count)
    .map((entry) => entry.key);
}

type Props = {
  dish: { id: string; name: string; venueId: string };
  /**
   * The dish's catalog taste estimate, when it has one. It picks the tastes the short popup asks
   * about; without it the popup asks about all six.
   */
  tasteVector?: TasteVector;
  /** "Write a review" in the popup: the review starts with these stars and taste levels. */
  onWriteReview: (rating: number, felt: FeltTaste) => void;
  /** "Not now" after picking stars or taste levels: they are kept as a review draft. */
  onKeepAnswers?: (rating: number, felt: FeltTaste) => void;
  /** The toast_cta variant: no popup, the bar's call to action becomes "Rate it". */
  onShowRateIt: () => void;
  /** The follow-up is over (popup closed, or the CTA was switched). */
  onClose: () => void;
};

/**
 * What follows a successful "Tried" mark. Mounted only then, so the dish_tried_prompt_v1
 * exposure fires for diners who actually reach the follow-up, never for every dish viewer.
 */
export function TriedFollowUp({
  dish,
  tasteVector,
  onWriteReview,
  onKeepAnswers,
  onShowRateIt,
  onClose,
}: Props) {
  const variant = useExperimentVariant("dish_tried_prompt_v1", { enabled: true });
  // Only a diner who sees the popup, on a dish with an estimate to pick the three tastes from.
  const axesVariant = useExperimentVariant("dish_tried_taste_axes_v1", {
    enabled: variant !== "toast_cta" && Boolean(tasteVector),
  });
  const [showAllTastes, setShowAllTastes] = useState(false);
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { height } = useWindowDimensions();
  const [rating, setRating] = useState(0);
  const [felt, setFelt] = useState<FeltTaste>({});
  const shownRef = useRef(false);
  // The pill waited while this popup was coming; the points are shown here instead.
  const heldPoints = useUIStore((state) => state.credHold?.points ?? 0);

  // Closing the popup ends the wait. The popup showed the points, so the pill stays away.
  useEffect(() => () => useUIStore.getState().releaseCredToast(false), []);

  useEffect(() => {
    if (variant === "toast_cta") {
      onShowRateIt();
      onClose();
      return;
    }
    if (shownRef.current) return;
    shownRef.current = true;
    trackAnalyticsEvent("tried_prompt_shown", { dish_id: dish.id, stall_id: dish.venueId });
    // Only the variant decides what to do; the parent's callbacks change every render.
  }, [variant]);

  if (variant === "toast_cta") return null;

  const shortList = axesVariant === "top3" && Boolean(tasteVector) && !showAllTastes;

  const dismiss = () => {
    trackAnalyticsEvent("tried_prompt_dismissed", {
      dish_id: dish.id,
      stall_id: dish.venueId,
      rated: rating > 0,
      taste_count: Object.keys(felt).length,
    });
    // What the diner picked is not thrown away: the review screen opens with it later.
    if (rating > 0 || Object.keys(felt).length > 0) onKeepAnswers?.(rating, felt);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View
        style={{
          backgroundColor: palette.mediaScrim,
          flex: 1,
          justifyContent: "center",
          padding: spacing[4],
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: palette.surface,
            borderRadius: componentRadii.card,
            // At large text the card scrolls instead of pushing its buttons off screen.
            maxHeight: height * 0.85,
            overflow: "hidden",
          }}
        >
          <ScrollView
            testID="tried-prompt-scroll"
            contentContainerStyle={{ gap: spacing[4], padding: spacing[5] }}
          >
            <View style={{ alignItems: "center", gap: spacing[1] }}>
              <AppText variant="h2" style={{ textAlign: "center" }}>
                {`You tried ${dish.name}`}
              </AppText>
              {heldPoints > 0 ? (
                <AppText
                  variant="bodySmallBold"
                  style={{ color: palette.orange, textAlign: "center" }}
                >
                  {`+${heldPoints} Food Cred`}
                </AppText>
              ) : null}
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                How was it? Both are optional.
              </AppText>
            </View>
            <View style={{ alignItems: "center", gap: spacing[2] }}>
              <AppText variant="bodySmallBold">Your rating</AppText>
              <StarRating value={rating} editable onChange={setRating} />
            </View>
            <View style={{ gap: spacing[2] }}>
              <AppText variant="bodySmallBold" style={{ textAlign: "center" }}>
                How did it taste?
              </AppText>
              <TasteRatingInput
                only={shortList && tasteVector ? strongestTasteKeys(tasteVector) : undefined}
                values={felt}
                onChange={(key, value) =>
                  setFelt((current) => {
                    const next = { ...current };
                    if (value === undefined) delete next[key];
                    else next[key] = value;
                    return next;
                  })
                }
              />
              {shortList ? (
                <Button
                  label="More tastes"
                  variant="ghost"
                  size="sm"
                  accessibilityHint="Shows the other taste questions"
                  onPress={() => setShowAllTastes(true)}
                />
              ) : null}
            </View>
            <View style={{ gap: spacing[2] }}>
              <Button label="Write a review" onPress={() => onWriteReview(rating, felt)} />
              <Button label="Not now" variant="ghost" onPress={dismiss} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
