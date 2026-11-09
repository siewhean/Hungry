import { Badge } from "@/components/ui";
import { portfolioRankLabel } from "@/features/foodPortfolio/useReviewPortfolioRanks";

/** "#2 in Sam's Food Portfolio": shown on a review whose dish is in its author's top three. */
export function PortfolioRankLabel({ rank, authorName }: { rank: number; authorName: string }) {
  const label = portfolioRankLabel(rank, authorName);
  return <Badge label={label} tone="amber" accessibilityLabel={`Ranked ${label}`} />;
}
