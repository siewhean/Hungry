import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useProfileStore } from "@/store/useProfileStore";
import type { Portfolio, PortfolioItem, PortfolioCollaborator } from "@/types/domain";
import type {
  PortfolioCreateInput,
  PortfolioItemCreateInput,
  PortfolioMutationOptions,
} from "@/lib/services/types";

interface PortfolioEditConflict {
  portfolioId: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  message: string;
  detectedAt: string;
}

/**
 * Which server query fills a Lists tab: lists you own, lists shared with you as a
 * collaborator, lists you follow, and public lists from everyone else.
 */
export type PortfolioListScope = "mine" | "shared" | "following" | "discover";

interface PortfolioState {
  /** Cache of every list loaded so far, by any scope or detail read. */
  portfolios: Portfolio[];
  /** Ids each tab's own server query returned, newest first. Undefined until loaded. */
  scopeIds: Partial<Record<PortfolioListScope, string[]>>;
  items: Record<string, PortfolioItem[]>;
  collaborators: Record<string, PortfolioCollaborator[]>;
  follows: Record<string, boolean>;
  conflicts: Record<string, PortfolioEditConflict>;
  isLoaded: boolean;

  loadPortfolios: (filters?: {
    userId?: string;
    visibility?: string;
    type?: string;
  }) => Promise<void>;
  /** Loads one tab's lists with its own server query and caches them by id. */
  loadPortfolioScope: (scope: PortfolioListScope) => Promise<void>;
  loadPortfolioItems: (portfolioId: string) => Promise<void>;
  loadPortfolioCollaborators: (portfolioId: string) => Promise<void>;
  checkFollowStatus: (portfolioId: string) => Promise<void>;
  /** Loads which lists the user follows, so the Following tab is right on a fresh install. */
  loadFollowedPortfolios: () => Promise<void>;

  createPortfolio: (input: PortfolioCreateInput) => Promise<Portfolio>;
  updatePortfolio: (id: string, updates: Partial<PortfolioCreateInput>) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  publishPortfolio: (id: string) => Promise<void>;

  addItem: (input: PortfolioItemCreateInput) => Promise<PortfolioItem>;
  updateItem: (id: string, updates: Partial<PortfolioItemCreateInput>) => Promise<void>;
  deleteItem: (id: string, portfolioId: string) => Promise<void>;
  reorderItems: (portfolioId: string, itemIds: string[]) => Promise<void>;

  addCollaborator: (
    portfolioId: string,
    userId: string,
    role: "viewer" | "editor",
  ) => Promise<void>;
  removeCollaborator: (portfolioId: string, userId: string) => Promise<void>;

  followPortfolio: (portfolioId: string) => Promise<void>;
  unfollowPortfolio: (portfolioId: string) => Promise<void>;

  flagPortfolio: (portfolioId: string, reason: string, details?: string) => Promise<void>;

  searchPortfolios: (
    query: string,
    filters?: { type?: string; visibility?: string },
  ) => Promise<Portfolio[]>;
  refreshPortfolio: (portfolioId: string) => Promise<Portfolio>;
  clearConflict: (portfolioId: string) => void;

  _reset: () => void;
}

type PortfolioSet = (
  partial:
    | Partial<PortfolioState>
    | PortfolioState
    | ((state: PortfolioState) => Partial<PortfolioState> | PortfolioState),
  replace?: false,
) => void;

function getAnalyticsUserId(): string | undefined {
  return useProfileStore.getState().profile.id;
}

function normalizeScore(score: PortfolioItemCreateInput["score"]): number | undefined {
  if (score === undefined) return undefined;
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    throw new Error("Portfolio item score must be between 1 and 10");
  }
  // The column and RPC parameter are integers: 7.5 would be rejected by the server.
  return Math.round(score);
}

function isSamePortfolioTarget(item: PortfolioItem, input: PortfolioItemCreateInput): boolean {
  if (item.itemType !== input.itemType) return false;
  if (input.itemType === "dish") return item.dishId === input.dishId;
  return item.stallId === input.stallId;
}

function assertCompleteReorder(
  portfolioId: string,
  currentItems: PortfolioItem[],
  itemIds: string[],
): void {
  const currentIds = new Set(currentItems.map((item) => item.id));
  const requestedIds = new Set(itemIds);
  const hasMissing = currentItems.some((item) => !requestedIds.has(item.id));
  const hasUnknown = itemIds.some((id) => !currentIds.has(id));
  if (hasMissing || hasUnknown || requestedIds.size !== itemIds.length) {
    throw new Error(`Portfolio ${portfolioId} reorder requires every current item exactly once`);
  }
}

function matchesPortfolioFilters(
  portfolio: Portfolio,
  filters?: { userId?: string; visibility?: string; type?: string },
): boolean {
  if (filters?.userId && portfolio.ownerId !== filters.userId) return false;
  if (filters?.visibility && portfolio.visibility !== filters.visibility) return false;
  if (filters?.type && portfolio.type !== filters.type) return false;
  return true;
}

/** Upserts fresh rows into the cache without dropping lists another tab loaded. */
function mergePortfolios(current: Portfolio[], incoming: Portfolio[]): Portfolio[] {
  const incomingIds = new Set(incoming.map((portfolio) => portfolio.id));
  return [...incoming, ...current.filter((portfolio) => !incomingIds.has(portfolio.id))];
}

function withoutId(ids: string[] | undefined, id: string): string[] | undefined {
  return ids?.filter((entry) => entry !== id);
}

async function fetchPortfolioScope(scope: PortfolioListScope): Promise<Portfolio[]> {
  const service = getHungryService();
  const profileId = useProfileStore.getState().profile.id;
  switch (scope) {
    case "mine":
      return service.portfolio.getPortfolios({ userId: profileId });
    case "shared":
      return service.portfolio.getPortfolios({
        ids: await service.portfolio.getSharedPortfolioIds(),
      });
    case "following":
      return service.portfolio.getPortfolios({
        ids: await service.portfolio.getFollowedPortfolioIds(),
      });
    case "discover":
      return (await service.portfolio.searchPortfolios("", { visibility: "public" })).filter(
        (portfolio) => portfolio.ownerId !== profileId,
      );
  }
}

function getPortfolioIdForItem(itemsByPortfolio: Record<string, PortfolioItem[]>, itemId: string) {
  return Object.entries(itemsByPortfolio).find(([, items]) =>
    items.some((item) => item.id === itemId),
  )?.[0];
}

function makePortfolioConflict(
  portfolioId: string,
  localUpdatedAt: string,
  remoteUpdatedAt: string,
): PortfolioEditConflict {
  return {
    portfolioId,
    localUpdatedAt,
    remoteUpdatedAt,
    detectedAt: new Date().toISOString(),
    message: "This portfolio changed elsewhere. Review the latest version before saving again.",
  };
}

function getPortfolioMutationOptions(
  portfolios: Portfolio[],
  portfolioId: string,
): PortfolioMutationOptions {
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  return {
    portfolioId,
    expectedUpdatedAt: portfolio?.updatedAt,
  };
}

async function ensurePortfolioFresh(
  get: () => PortfolioState,
  set: PortfolioSet,
  portfolioId: string,
): Promise<void> {
  const localPortfolio = get().portfolios.find((portfolio) => portfolio.id === portfolioId);
  if (!localPortfolio) return;

  const service = getHungryService();
  const remotePortfolio = await service.portfolio.getPortfolio(portfolioId);
  if (remotePortfolio.updatedAt === localPortfolio.updatedAt) return;

  const [remoteItemsResult, remoteCollaboratorsResult] = await Promise.allSettled([
    service.portfolio.getPortfolioItems(portfolioId),
    service.portfolio.getPortfolioCollaborators(portfolioId),
  ]);

  const conflict = makePortfolioConflict(
    portfolioId,
    localPortfolio.updatedAt,
    remotePortfolio.updatedAt,
  );
  set((state) => ({
    portfolios: [
      remotePortfolio,
      ...state.portfolios.filter((portfolio) => portfolio.id !== portfolioId),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    items:
      remoteItemsResult.status === "fulfilled"
        ? { ...state.items, [portfolioId]: remoteItemsResult.value }
        : state.items,
    collaborators:
      remoteCollaboratorsResult.status === "fulfilled"
        ? { ...state.collaborators, [portfolioId]: remoteCollaboratorsResult.value }
        : state.collaborators,
    conflicts: { ...state.conflicts, [portfolioId]: conflict },
  }));
  throw new Error(conflict.message);
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      portfolios: [],
      scopeIds: {},
      items: {},
      collaborators: {},
      follows: {},
      conflicts: {},
      isLoaded: false,

      loadPortfolios: async (filters) => {
        const service = getHungryService();
        try {
          const portfolios = await service.portfolio.getPortfolios(filters);
          // Merge, never replace: a capped read must not drop lists another screen shows.
          set((state) => ({
            portfolios: mergePortfolios(state.portfolios, portfolios),
            isLoaded: true,
          }));
        } catch (error) {
          if (get().portfolios.some((portfolio) => matchesPortfolioFilters(portfolio, filters))) {
            set({ isLoaded: true });
            return;
          }
          throw error;
        }
      },

      loadPortfolioScope: async (scope) => {
        try {
          const portfolios = await fetchPortfolioScope(scope);
          set((state) => ({
            portfolios: mergePortfolios(state.portfolios, portfolios),
            scopeIds: { ...state.scopeIds, [scope]: portfolios.map((portfolio) => portfolio.id) },
            follows:
              scope === "following"
                ? {
                    ...state.follows,
                    ...Object.fromEntries(portfolios.map((portfolio) => [portfolio.id, true])),
                  }
                : state.follows,
            isLoaded: true,
          }));
        } catch (error) {
          // Offline: keep showing this tab's last result.
          if (get().scopeIds[scope]) return;
          throw error;
        }
      },

      loadPortfolioItems: async (portfolioId: string) => {
        const service = getHungryService();
        try {
          const items = await service.portfolio.getPortfolioItems(portfolioId);
          set((state) => ({
            items: { ...state.items, [portfolioId]: items },
          }));
        } catch (error) {
          if (get().items[portfolioId]) {
            return;
          }
          throw error;
        }
      },

      loadPortfolioCollaborators: async (portfolioId: string) => {
        const service = getHungryService();
        try {
          const collaborators = await service.portfolio.getPortfolioCollaborators(portfolioId);
          set((state) => ({
            collaborators: { ...state.collaborators, [portfolioId]: collaborators },
          }));
        } catch (error) {
          if (get().collaborators[portfolioId]) {
            return;
          }
          throw error;
        }
      },

      checkFollowStatus: async (portfolioId: string) => {
        const service = getHungryService();
        try {
          const isFollowing = await service.portfolio.isFollowingPortfolio(portfolioId);
          set((state) => ({
            follows: { ...state.follows, [portfolioId]: isFollowing },
          }));
        } catch (error) {
          if (portfolioId in get().follows) {
            return;
          }
          throw error;
        }
      },

      loadFollowedPortfolios: async () => {
        const ids = await getHungryService().portfolio.getFollowedPortfolioIds();
        set({ follows: Object.fromEntries(ids.map((id) => [id, true])) });
      },

      createPortfolio: async (input: PortfolioCreateInput) => {
        const service = getHungryService();
        const portfolio = await service.portfolio.createPortfolio(input);
        set((state) => ({
          portfolios: [...state.portfolios, portfolio],
          scopeIds: state.scopeIds.mine
            ? { ...state.scopeIds, mine: [portfolio.id, ...state.scopeIds.mine] }
            : state.scopeIds,
          conflicts: Object.fromEntries(
            Object.entries(state.conflicts).filter(([key]) => key !== portfolio.id),
          ),
        }));
        trackAnalyticsEvent(
          "portfolio_created",
          {
            portfolio_id: portfolio.id,
            type: portfolio.type,
            visibility: portfolio.visibility,
          },
          { userId: getAnalyticsUserId() },
        );
        return portfolio;
      },

      updatePortfolio: async (id: string, updates: Partial<PortfolioCreateInput>) => {
        await ensurePortfolioFresh(get, set, id);
        const service = getHungryService();
        await service.portfolio.updatePortfolio(
          id,
          updates,
          getPortfolioMutationOptions(get().portfolios, id),
        );
        await get().refreshPortfolio(id);
      },

      deletePortfolio: async (id: string) => {
        await ensurePortfolioFresh(get, set, id);
        const service = getHungryService();
        await service.portfolio.deletePortfolio(
          id,
          getPortfolioMutationOptions(get().portfolios, id),
        );
        set((state) => ({
          portfolios: state.portfolios.filter((p) => p.id !== id),
          scopeIds: Object.fromEntries(
            Object.entries(state.scopeIds).map(([scope, ids]) => [scope, withoutId(ids, id)]),
          ),
          items: Object.fromEntries(Object.entries(state.items).filter(([key]) => key !== id)),
          collaborators: Object.fromEntries(
            Object.entries(state.collaborators).filter(([key]) => key !== id),
          ),
          follows: Object.fromEntries(Object.entries(state.follows).filter(([key]) => key !== id)),
          conflicts: Object.fromEntries(
            Object.entries(state.conflicts).filter(([key]) => key !== id),
          ),
        }));
      },

      publishPortfolio: async (id: string) => {
        await ensurePortfolioFresh(get, set, id);
        const portfolioBeforePublish = get().portfolios.find((portfolio) => portfolio.id === id);
        const service = getHungryService();
        await service.portfolio.publishPortfolio(
          id,
          getPortfolioMutationOptions(get().portfolios, id),
        );
        await get().refreshPortfolio(id);
        if (!portfolioBeforePublish?.publishedAt) {
          trackAnalyticsEvent(
            "portfolio_published",
            {
              portfolio_id: id,
              type: portfolioBeforePublish?.type,
              visibility: "public",
            },
            { userId: getAnalyticsUserId() },
          );
        }
      },

      addItem: async (input: PortfolioItemCreateInput) => {
        await ensurePortfolioFresh(get, set, input.portfolioId);
        const normalizedInput = { ...input, score: normalizeScore(input.score) };
        if (!get().items[input.portfolioId]) {
          await get().loadPortfolioItems(input.portfolioId);
        }
        const currentItems = get().items[input.portfolioId] ?? [];
        if (currentItems.some((item) => isSamePortfolioTarget(item, normalizedInput))) {
          throw new Error("This item is already in the portfolio");
        }
        const service = getHungryService();
        const item = await service.portfolio.addPortfolioItem(
          normalizedInput,
          getPortfolioMutationOptions(get().portfolios, input.portfolioId),
        );
        set((state) => ({
          items: {
            ...state.items,
            [input.portfolioId]: [...(state.items[input.portfolioId] || []), item],
          },
        }));
        await get().refreshPortfolio(input.portfolioId);
        trackAnalyticsEvent(
          "portfolio_item_added",
          {
            portfolio_id: normalizedInput.portfolioId,
            item_type: normalizedInput.itemType,
            dish_id: normalizedInput.dishId,
            stall_id: normalizedInput.stallId,
            score: normalizedInput.score,
          },
          { userId: getAnalyticsUserId() },
        );
        return item;
      },

      updateItem: async (id: string, updates: Partial<PortfolioItemCreateInput>) => {
        const portfolioId = getPortfolioIdForItem(get().items, id);
        if (portfolioId) {
          await ensurePortfolioFresh(get, set, portfolioId);
        }
        const service = getHungryService();
        const normalizedUpdates = { ...updates, score: normalizeScore(updates.score) };
        await service.portfolio.updatePortfolioItem(
          id,
          normalizedUpdates,
          portfolioId ? getPortfolioMutationOptions(get().portfolios, portfolioId) : undefined,
        );
        set((state) => {
          const newItems = { ...state.items };
          for (const portfolioId in newItems) {
            newItems[portfolioId] = newItems[portfolioId].map((item) =>
              item.id === id ? { ...item, ...normalizedUpdates } : item,
            );
          }
          return { items: newItems };
        });
        if (portfolioId) {
          await get().refreshPortfolio(portfolioId);
        }
      },

      deleteItem: async (id: string, portfolioId: string) => {
        await ensurePortfolioFresh(get, set, portfolioId);
        const service = getHungryService();
        await service.portfolio.deletePortfolioItem(
          id,
          getPortfolioMutationOptions(get().portfolios, portfolioId),
        );
        set((state) => ({
          items: {
            ...state.items,
            [portfolioId]: (state.items[portfolioId] ?? []).filter((item) => item.id !== id),
          },
        }));
        trackAnalyticsEvent(
          "list_item_removed",
          { list_kind: "portfolio", list_id: portfolioId },
          { userId: getAnalyticsUserId() },
        );
        await get().refreshPortfolio(portfolioId);
      },

      reorderItems: async (portfolioId: string, itemIds: string[]) => {
        await ensurePortfolioFresh(get, set, portfolioId);
        const service = getHungryService();
        const items = get().items[portfolioId] || [];
        assertCompleteReorder(portfolioId, items, itemIds);
        await service.portfolio.reorderPortfolioItems(
          portfolioId,
          itemIds,
          getPortfolioMutationOptions(get().portfolios, portfolioId),
        );
        set((state) => {
          const items = state.items[portfolioId] || [];
          const itemById = new Map(items.map((item) => [item.id, item]));
          const reordered = itemIds
            .map((id) => itemById.get(id))
            .filter(Boolean) as PortfolioItem[];
          return {
            items: { ...state.items, [portfolioId]: reordered },
          };
        });
        await get().refreshPortfolio(portfolioId);
      },

      addCollaborator: async (portfolioId: string, userId: string, role: "viewer" | "editor") => {
        await ensurePortfolioFresh(get, set, portfolioId);
        const service = getHungryService();
        await service.portfolio.addPortfolioCollaborator(
          portfolioId,
          userId,
          role,
          getPortfolioMutationOptions(get().portfolios, portfolioId),
        );
        await get().loadPortfolioCollaborators(portfolioId);
        await get().refreshPortfolio(portfolioId);
      },

      removeCollaborator: async (portfolioId: string, userId: string) => {
        await ensurePortfolioFresh(get, set, portfolioId);
        const service = getHungryService();
        await service.portfolio.removePortfolioCollaborator(
          portfolioId,
          userId,
          getPortfolioMutationOptions(get().portfolios, portfolioId),
        );
        set((state) => ({
          collaborators: {
            ...state.collaborators,
            [portfolioId]: (state.collaborators[portfolioId] ?? []).filter(
              (c) => c.userId !== userId,
            ),
          },
        }));
        await get().refreshPortfolio(portfolioId);
      },

      followPortfolio: async (portfolioId: string) => {
        const service = getHungryService();
        await service.portfolio.followPortfolio(portfolioId);
        set((state) => ({
          follows: { ...state.follows, [portfolioId]: true },
          scopeIds:
            state.scopeIds.following && !state.scopeIds.following.includes(portfolioId)
              ? { ...state.scopeIds, following: [portfolioId, ...state.scopeIds.following] }
              : state.scopeIds,
        }));
        trackAnalyticsEvent(
          "portfolio_followed",
          { portfolio_id: portfolioId },
          { userId: getAnalyticsUserId() },
        );
      },

      unfollowPortfolio: async (portfolioId: string) => {
        const service = getHungryService();
        await service.portfolio.unfollowPortfolio(portfolioId);
        set((state) => ({
          follows: { ...state.follows, [portfolioId]: false },
          scopeIds: state.scopeIds.following
            ? { ...state.scopeIds, following: withoutId(state.scopeIds.following, portfolioId) }
            : state.scopeIds,
        }));
      },

      flagPortfolio: async (portfolioId: string, reason: string, details?: string) => {
        const service = getHungryService();
        await service.portfolio.flagPortfolio(portfolioId, reason, details);
        trackAnalyticsEvent(
          "portfolio_flagged",
          { portfolio_id: portfolioId, reason },
          { userId: getAnalyticsUserId() },
        );
      },

      searchPortfolios: async (query: string, filters?: { type?: string; visibility?: string }) => {
        const service = getHungryService();
        return await service.portfolio.searchPortfolios(query, filters);
      },

      refreshPortfolio: async (portfolioId: string) => {
        const service = getHungryService();
        const portfolio = await service.portfolio.getPortfolio(portfolioId);
        set((state) => ({
          portfolios: [
            portfolio,
            ...state.portfolios.filter((entry) => entry.id !== portfolioId),
          ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
          conflicts: Object.fromEntries(
            Object.entries(state.conflicts).filter(([key]) => key !== portfolioId),
          ),
        }));
        return portfolio;
      },

      clearConflict: (portfolioId: string) => {
        set((state) => ({
          conflicts: Object.fromEntries(
            Object.entries(state.conflicts).filter(([key]) => key !== portfolioId),
          ),
        }));
      },

      _reset: () =>
        set({
          portfolios: [],
          scopeIds: {},
          items: {},
          collaborators: {},
          follows: {},
          conflicts: {},
          isLoaded: false,
        }),
    }),
    {
      name: "portfolio-storage",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        portfolios: state.portfolios,
        scopeIds: state.scopeIds,
        items: state.items,
        collaborators: state.collaborators,
        follows: state.follows,
        conflicts: state.conflicts,
      }),
    },
  ),
);
