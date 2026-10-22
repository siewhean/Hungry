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

/** One line under each list type, so the picker says what the type is for. */
export const PORTFOLIO_TYPE_DESCRIPTIONS: Record<PortfolioType, string> = {
  recommendation: "Places and dishes you'd tell a friend about.",
  ranking: "A numbered top list, with an optional score for each pick.",
  trail: "A route of stops to eat along, in order.",
  collection: "Any themed group of stalls and dishes.",
};

/** Who can see a list at each visibility level. */
export const PORTFOLIO_VISIBILITY_DESCRIPTIONS: Record<PortfolioVisibility, string> = {
  private: "Only you and the collaborators you add.",
  followers_only: "Only people who follow you, plus your collaborators.",
  public: "Anyone with the link, and it shows up in search.",
};

/** Database limits (portfolios.name, portfolios.description, portfolio_items notes). */
export const PORTFOLIO_NAME_MAX_LENGTH = 100;
export const PORTFOLIO_TEXT_MAX_LENGTH = 500;

/** Reasons a list report can give; matches the portfolio_flags reason check. */
export const PORTFOLIO_REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Something else" },
] as const;

export type PortfolioReportReason = (typeof PORTFOLIO_REPORT_REASONS)[number]["value"];

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

/**
 * A list is live whenever it is public, however it got there (Publish, or choosing
 * "Public" when creating or editing it): the link works and it is searchable.
 * Switching it back to private unpublishes it.
 */
export function isPortfolioLive(portfolio: Pick<Portfolio, "publishedAt" | "visibility">): boolean {
  return portfolio.visibility === "public";
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
