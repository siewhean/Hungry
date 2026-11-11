import { View } from "react-native";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import { FormSwitchRow, AppText, Button, SegmentedControl } from "@/components/ui";
import { TasteRatingInput } from "@/components/review";
import { dishTypeWords, entryName } from "@/features/foodPortfolio/portfolioEntryActions";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import type { TasteKey } from "@/types/domain";

/** Dishes a portfolio needs before its picks show as a label on reviews. */
export const PORTFOLIO_LABEL_MIN_DISHES = 5;

export type PortfolioEntryChoice = "public" | "private";

type Props = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** A portfolio entry is a post, so it needs a photo. */
  hasPhoto: boolean;
  felt: Partial<Record<TasteKey, number>>;
  /** Our guess for each taste, shown as soft rings. */
  suggestions?: Partial<Record<TasteKey, number>>;
  onFeltChange: (key: TasteKey, value: number | undefined) => void;
  /** Fills every taste still unanswered with our guess. */
  onUseGuess: () => void;
  visibility: PortfolioEntryChoice;
  onVisibilityChange: (visibility: PortfolioEntryChoice) => void;
  /** The dish's type ("chicken rice"); without one the dish cannot be a best. */
  foodType?: string;
  makeBest: boolean;
  onMakeBestChange: (makeBest: boolean) => void;
  /** Your current best of this dish type, which this entry would replace. */
  currentBest?: Pick<Bite, "dishName" | "venueName"> | null;
};

/** What the best switch says it does: the dish it replaces, or that it is the first. */
export function bestSwitchDescription(
  foodType: string,
  currentBest?: Pick<Bite, "dishName" | "venueName"> | null,
): string {
  return currentBest
    ? `Replaces ${entryName(currentBest)}, which stays in your diary.`
    : `Your first best ${dishTypeWords(foodType)}.`;
}

/**
 * "Add a dish" in the editor: put the dish in your Food Portfolio diary, Public or Only me, make it
 * your best of its dish type (naming the one it replaces), and rate the tastes if you like.
 */
export function ReviewPortfolioSection({
  enabled,
  onToggle,
  hasPhoto,
  felt,
  suggestions,
  onFeltChange,
  onUseGuess,
  visibility,
  onVisibilityChange,
  foodType,
  makeBest,
  onMakeBestChange,
  currentBest,
}: Props) {
  const { spacing } = useHungryTheme();
  const answered = TASTE_DIMENSIONS.filter(({ key }) => typeof felt[key] === "number").length;
  const canBeBest = Boolean(foodType?.trim()) && visibility === "public";

  return (
    <View style={{ gap: spacing[3] }} testID="review-portfolio-section">
      <FormSwitchRow
        label="Add to my Food Portfolio"
        description="Keep this dish in the diary on your profile."
        value={enabled}
        onValueChange={onToggle}
      />
      {enabled ? (
        <View style={{ gap: spacing[4] }}>
          {!hasPhoto ? (
            <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
              Add a photo above to put it in your portfolio too. Without one, only the review is
              posted.
            </AppText>
          ) : null}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Who can see it</AppText>
            <SegmentedControl
              testID="review-portfolio-visibility"
              accessibilityLabel="Who can see this dish"
              options={[
                { value: "public", label: "Public", accessibilityLabel: "Public" },
                { value: "private", label: "Only me", accessibilityLabel: "Only me" },
              ]}
              value={visibility}
              onChange={onVisibilityChange}
            />
            {visibility === "private" ? (
              <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
                {"Only you see it. It earns no points and can't be one of your bests."}
              </AppText>
            ) : null}
          </View>
          {canBeBest && foodType ? (
            <FormSwitchRow
              label={`Make this my best ${dishTypeWords(foodType)}`}
              description={bestSwitchDescription(foodType, currentBest)}
              value={makeBest}
              onValueChange={onMakeBestChange}
            />
          ) : null}
          <View style={{ gap: spacing[2] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h3">Rate the tastes (optional)</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {answered} of {TASTE_DIMENSIONS.length} rated. Dashed rings are our guess for your
                palate.
              </AppText>
            </View>
            <TasteRatingInput values={felt} suggestions={suggestions} onChange={onFeltChange} />
            {answered < TASTE_DIMENSIONS.length && suggestions ? (
              <Button label="Use our guess for the rest" variant="secondary" onPress={onUseGuess} />
            ) : null}
          </View>
          <AppText variant="micro" tone="muted">
            {`Your bests show on your reviews once your portfolio has ${PORTFOLIO_LABEL_MIN_DISHES} public dishes.`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
