import { Badge } from "@/components/ui";
import { portfolioLabelText } from "@/features/foodPortfolio/useReviewPortfolioLabels";
import type { ReviewPortfolioLabel } from "@/lib/services/types";

/** "Emma's best laksa" or "#2 in Emma's Food Portfolio": shown on a review whose dish is a pick. */
export function PortfolioLabel({
  label,
  authorName,
}: {
  label: Pick<ReviewPortfolioLabel, "foodType" | "overallPlace">;
  authorName: string;
}) {
  const text = portfolioLabelText(label, authorName);
  if (!text) return null;
  return <Badge label={text} tone="amber" accessibilityLabel={text} />;
}
