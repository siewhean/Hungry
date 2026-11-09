import { ScrollView, View } from "react-native";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import { FormSwitchRow, AppText, Button } from "@/components/ui";
import { TasteRatingInput } from "@/components/review";
import { tasteMatchLabel } from "@/features/detail/tasteMatch";
import {
  PORTFOLIO_LABEL_MIN_DISHES,
  hasRatedAllTastes,
  isTopThreePlace,
  type PortfolioRank,
} from "@/features/foodPortfolio/reviewPortfolioRank";
import { useHungryTheme } from "@/theme";
import type { TasteKey } from "@/types/domain";

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
  /** Places on offer: one more than the dishes already ranked. */
  placeCount: number;
  /** Where the dish would sit in the ranking; undefined until stars and tastes are in. */
  suggestedRank?: PortfolioRank;
  /** 0-100 palate match behind the suggestion. */
  matchPercent?: number;
  rank: PortfolioRank;
  onRankChange: (rank: PortfolioRank) => void;
};

/** The sentence under Publish while a portfolio entry is not ready; null when it is. */
export function portfolioBlockedReason(
  felt: Partial<Record<TasteKey, number>>,
  hasPhoto: boolean,
): string | null {
  if (!hasPhoto) return "Add a photo to put this dish in your portfolio.";
  if (!hasRatedAllTastes(felt)) return "Rate all six tastes to put this dish in your portfolio.";
  return null;
}

function rankLabel(rank: PortfolioRank): string {
  if (rank === null) return "no place";
  return isTopThreePlace(rank) ? `#${rank}, in your top three` : `#${rank}`;
}

/**
 * "Add to my Food Portfolio" in the review editor: rate the six tastes, then pick the dish's
 * place in the top three. We suggest a place from the stars and how close the dish is to the
 * reviewer's palate; the reviewer can pick any other.
 */
export function ReviewPortfolioSection({
  enabled,
  onToggle,
  hasPhoto,
  felt,
  suggestions,
  onFeltChange,
  onUseGuess,
  placeCount,
  suggestedRank,
  matchPercent,
  rank,
  onRankChange,
}: Props) {
  const { spacing } = useHungryTheme();
  const rated = hasRatedAllTastes(felt);
  const answered = TASTE_DIMENSIONS.filter(({ key }) => typeof felt[key] === "number").length;

  return (
    <View style={{ gap: spacing[3] }}>
      <FormSwitchRow
        label="Add to my Food Portfolio"
        description="Show this dish on your profile and choose where it ranks."
        value={enabled}
        onValueChange={onToggle}
      />
      {enabled ? (
        <View style={{ gap: spacing[4] }}>
          {!hasPhoto ? (
            <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
              Add a photo above: a portfolio entry needs one.
            </AppText>
          ) : null}
          <View style={{ gap: spacing[2] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h3">Rate the tastes</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {answered} of {TASTE_DIMENSIONS.length} rated. Dashed rings are our guess for your
                palate.
              </AppText>
            </View>
            <TasteRatingInput values={felt} suggestions={suggestions} onChange={onFeltChange} />
            {!rated && suggestions ? (
              <Button label="Use our guess for the rest" variant="secondary" onPress={onUseGuess} />
            ) : null}
          </View>
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Where does it rank?</AppText>
            {rated && suggestedRank !== undefined ? (
              <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
                {`We suggest ${rankLabel(suggestedRank)}${
                  matchPercent !== undefined
                    ? `: ${tasteMatchLabel(matchPercent).toLowerCase()} (${matchPercent}% match)`
                    : ""
                }.`}
              </AppText>
            ) : (
              <AppText variant="bodySmall" tone="secondary">
                Rate all six tastes and we will suggest a place.
              </AppText>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[2] }}
              accessibilityLabel="Places in your ranking"
            >
              {Array.from({ length: placeCount }, (_, index) => index + 1).map((place) => (
                <Button
                  key={place}
                  label={`#${place}`}
                  size="sm"
                  fullWidth={false}
                  variant={rank === place ? "primary" : "secondary"}
                  accessibilityState={{ selected: rank === place }}
                  onPress={() => onRankChange(place)}
                />
              ))}
              <Button
                label="Unranked"
                size="sm"
                fullWidth={false}
                variant={rank === null ? "primary" : "secondary"}
                accessibilityState={{ selected: rank === null }}
                onPress={() => onRankChange(null)}
              />
            </ScrollView>
            <AppText variant="micro" tone="muted">
              {`Rank as many dishes as you like. A top-three place shows on this review once your portfolio has ${PORTFOLIO_LABEL_MIN_DISHES} dishes.`}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
