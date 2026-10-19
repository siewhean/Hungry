import type { Portfolio, PortfolioType, PortfolioVisibility } from "@/types/domain";

/** Reader-facing names for list enums, so screens never show raw values like "followers_only". */
export const PORTFOLIO_TYPE_LABELS: Record<PortfolioType, string> = {
  recommendation: "Recommendations",
  ranking: "Ranking",
  trail: "Food trail",
  collection: "Collection",
};

export const PORTFOLIO_VISIBILITY_LABELS: Record<PortfolioVisibility, string> = {
  private: "Private",
  followers_only: "Followers",
  public: "Public",
};

export function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function formatPortfolioSummary(
  portfolio: Pick<Portfolio, "type" | "visibility">,
  itemCount: number,
): string {
  return [
    PORTFOLIO_TYPE_LABELS[portfolio.type] ?? portfolio.type,
    PORTFOLIO_VISIBILITY_LABELS[portfolio.visibility] ?? portfolio.visibility,
    formatItemCount(itemCount),
  ].join(" · ");
}

/** A list counts as published only while it is public; switching it back to private unpublishes it. */
export function isPortfolioLive(portfolio: Pick<Portfolio, "publishedAt" | "visibility">): boolean {
  return Boolean(portfolio.publishedAt) && portfolio.visibility === "public";
}

/**
 * Server count when the list read included it (list loads and post-mutation refreshes do),
 * otherwise the items loaded on this device, otherwise 0.
 */
export function resolveListItemCount(
  list: { itemCount?: number },
  loadedItems?: readonly unknown[],
): number {
  return list.itemCount ?? loadedItems?.length ?? 0;
}
