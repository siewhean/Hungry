import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View, useWindowDimensions } from "react-native";

import { StarRating, TasteRatingInput } from "@/components/review";
import { AppText, Button } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { TasteKey } from "@/types/domain";

/** How strong each taste felt, in the review editor's 0-10 steps. Axes left out were not rated. */
export type FeltTaste = Partial<Record<TasteKey, number>>;

type Props = {
  dish: { id: string; name: string; venueId: string };
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
  onWriteReview,
  onKeepAnswers,
  onShowRateIt,
  onClose,
}: Props) {
  const variant = useExperimentVariant("dish_tried_prompt_v1", { enabled: true });
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
