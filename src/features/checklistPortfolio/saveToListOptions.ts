import type { Portfolio } from "@/types/domain";

/** The private quick-save list a dish or stall page offers first. */
export const DEFAULT_PORTFOLIO_NAME = "Hungry Picks";

export interface SaveToListOption {
  /** Portfolio id, or "default" for a Hungry Picks list that doesn't exist yet. */
  key: string;
  name: string;
  /** Undefined until the default list is created on first save. */
  portfolio?: Portfolio;
  /** True for lists someone else owns that you can edit. */
  isShared: boolean;
}

/**
 * Lists a dish or stall page can save to: Hungry Picks first (offered even before
 * it exists), then your other lists, then lists shared with you as an editor.
 */
export function buildSaveToListOptions(
  portfolios: readonly Portfolio[],
  ownIds: readonly string[],
  editorIds: readonly string[],
  profileId: string,
): SaveToListOption[] {
  const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
  const own = ownIds
    .map((id) => byId.get(id))
    .filter((portfolio): portfolio is Portfolio => portfolio?.ownerId === profileId);
  const defaultList = own.find((portfolio) => portfolio.name === DEFAULT_PORTFOLIO_NAME);
  const shared = editorIds
    .map((id) => byId.get(id))
    .filter((portfolio): portfolio is Portfolio =>
      Boolean(portfolio && portfolio.ownerId !== profileId),
    );

  return [
    defaultList
      ? { key: defaultList.id, name: defaultList.name, portfolio: defaultList, isShared: false }
      : { key: "default", name: DEFAULT_PORTFOLIO_NAME, isShared: false },
    ...own
      .filter((portfolio) => portfolio !== defaultList)
      .map((portfolio) => ({
        key: portfolio.id,
        name: portfolio.name,
        portfolio,
        isShared: false,
      })),
    ...shared.map((portfolio) => ({
      key: portfolio.id,
      name: portfolio.name,
      portfolio,
      isShared: true,
    })),
  ];
}
