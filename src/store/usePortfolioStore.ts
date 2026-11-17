import { create } from "zustand";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
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

let generation = 0;
function scopedService(expectedGeneration = generation): ReturnType<typeof getHungryService> {
  if (expectedGeneration !== generation) throw new Error("Account changed. Reopen this tool.");
  const subject = useProfileStore.getState().profile.id;
  const wrap = (value: object): object =>
    new Proxy(value, {
      get(target, key, receiver) {
        const member: unknown = Reflect.get(target, key, receiver);
        if (typeof member === "function")
          return (...args: unknown[]) => {
            if (
              generation !== expectedGeneration ||
              subject !== useProfileStore.getState().profile.id
            )
              throw new Error("Account changed. Reopen this tool.");
            const result: unknown = Reflect.apply(member, target, args);
            return Promise.resolve(result).then((resolved: unknown) => {
              if (
                generation !== expectedGeneration ||
                subject !== useProfileStore.getState().profile.id
              )
                throw new Error("Account changed. Reopen this tool.");
              return resolved;
            });
          };
        return member && typeof member === "object" ? wrap(member) : member;
      },
    });
  return wrap(getHungryService()) as ReturnType<typeof getHungryService>;
}

interface PortfolioState {
  portfolios: Portfolio[];
  items: Record<string, PortfolioItem[]>;
  collaborators: Record<string, PortfolioCollaborator[]>;
  follows: Record<string, boolean>;
  followerCounts: Record<string, number>;
  conflicts: Record<string, PortfolioEditConflict>;
  isLoaded: boolean;

  loadPortfolios: (filters?: {
    userId?: string;
    visibility?: string;
    type?: string;
  }) => Promise<void>;
  loadPortfolioItems: (portfolioId: string) => Promise<void>;
  loadPortfolioCollaborators: (portfolioId: string) => Promise<void>;
  checkFollowStatus: (portfolioId: string) => Promise<void>;

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

function normalizeScore(score: PortfolioItemCreateInput["score"]): number | null | undefined {
  if (score === undefined || score === null) return score;
  if (!Number.isFinite(score) || score < 1 || score > 10 || !Number.isInteger(score * 10)) {
    throw new Error("Portfolio item score must be between 1 and 10");
  }
  return score;
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
  const epoch = generation;
  const localPortfolio = get().portfolios.find((portfolio) => portfolio.id === portfolioId);
  if (!localPortfolio) return;

  const service = scopedService();
  const remotePortfolio = await service.portfolio.getPortfolio(portfolioId);
  if (remotePortfolio.updatedAt === localPortfolio.updatedAt) return;

  const [remoteItemsResult, remoteCollaboratorsResult] = await Promise.allSettled([
    service.portfolio.getPortfolioItems(portfolioId),
    service.portfolio.getPortfolioCollaborators(portfolioId),
  ]);

  if (epoch !== generation) throw new Error("Account changed. Reopen this tool.");
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

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  portfolios: [],
  items: {},
  collaborators: {},
  follows: {},
  followerCounts: {},
  conflicts: {},
  isLoaded: false,

  loadPortfolios: async (filters) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const portfolios = await service.portfolio.getPortfolios(filters);
      set({ portfolios, isLoaded: true });
    } catch (error) {
      throw error;
    }
  },

  loadPortfolioItems: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const items = await service.portfolio.getPortfolioItems(portfolioId);
      set((state) => ({
        items: { ...state.items, [portfolioId]: items },
      }));
    } catch (error) {
      throw error;
    }
  },

  loadPortfolioCollaborators: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const collaborators = await service.portfolio.getPortfolioCollaborators(portfolioId);
      set((state) => ({
        collaborators: { ...state.collaborators, [portfolioId]: collaborators },
      }));
    } catch (error) {
      throw error;
    }
  },

  checkFollowStatus: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const [isFollowing, followers] = await Promise.all([
        service.portfolio.isFollowingPortfolio(portfolioId),
        service.portfolio.getPortfolioFollows(portfolioId),
      ]);
      set((state) => ({
        follows: { ...state.follows, [portfolioId]: isFollowing },
        followerCounts: { ...state.followerCounts, [portfolioId]: followers.length },
      }));
    } catch (error) {
      throw error;
    }
  },

  createPortfolio: async (input: PortfolioCreateInput) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    const portfolio = await service.portfolio.createPortfolio(input);
    set((state) => ({
      portfolios: [...state.portfolios, portfolio],
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
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, id);
    const service = scopedService(actionGeneration);
    await service.portfolio.updatePortfolio(
      id,
      updates,
      getPortfolioMutationOptions(get().portfolios, id),
    );
    await get().refreshPortfolio(id);
  },

  deletePortfolio: async (id: string) => {
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, id);
    const service = scopedService(actionGeneration);
    await service.portfolio.deletePortfolio(id, getPortfolioMutationOptions(get().portfolios, id));
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
      items: Object.fromEntries(Object.entries(state.items).filter(([key]) => key !== id)),
      collaborators: Object.fromEntries(
        Object.entries(state.collaborators).filter(([key]) => key !== id),
      ),
      follows: Object.fromEntries(Object.entries(state.follows).filter(([key]) => key !== id)),
      conflicts: Object.fromEntries(Object.entries(state.conflicts).filter(([key]) => key !== id)),
    }));
  },

  publishPortfolio: async (id: string) => {
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, id);
    const portfolioBeforePublish = get().portfolios.find((portfolio) => portfolio.id === id);
    const service = scopedService(actionGeneration);
    await service.portfolio.publishPortfolio(id, getPortfolioMutationOptions(get().portfolios, id));
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
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, input.portfolioId);
    const normalizedInput = { ...input, score: normalizeScore(input.score) };
    if (!get().items[input.portfolioId]) {
      await get().loadPortfolioItems(input.portfolioId);
    }
    const currentItems = get().items[input.portfolioId] ?? [];
    if (currentItems.some((item) => isSamePortfolioTarget(item, normalizedInput))) {
      throw new Error("This item is already in the portfolio");
    }
    const service = scopedService(actionGeneration);
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
    const actionGeneration = generation;
    const portfolioId = getPortfolioIdForItem(get().items, id);
    if (portfolioId) {
      await ensurePortfolioFresh(get, set, portfolioId);
    }
    const service = scopedService(actionGeneration);
    const normalizedUpdates = {
      ...updates,
      ...(Object.hasOwn(updates, "score") ? { score: normalizeScore(updates.score) } : {}),
    };
    await service.portfolio.updatePortfolioItem(
      id,
      normalizedUpdates,
      portfolioId ? getPortfolioMutationOptions(get().portfolios, portfolioId) : undefined,
    );
    set((state) => {
      const newItems = { ...state.items };
      for (const portfolioId in newItems) {
        newItems[portfolioId] = newItems[portfolioId].map((item) =>
          item.id === id
            ? {
                ...item,
                ...normalizedUpdates,
                score:
                  normalizedUpdates.score === undefined
                    ? item.score
                    : (normalizedUpdates.score ?? undefined),
                publicNotes:
                  normalizedUpdates.publicNotes === undefined
                    ? item.publicNotes
                    : (normalizedUpdates.publicNotes ?? undefined),
                privateNotes:
                  normalizedUpdates.privateNotes === undefined
                    ? item.privateNotes
                    : (normalizedUpdates.privateNotes ?? undefined),
              }
            : item,
        );
      }
      return { items: newItems };
    });
    if (portfolioId) {
      await get().refreshPortfolio(portfolioId);
    }
  },

  deleteItem: async (id: string, portfolioId: string) => {
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, portfolioId);
    const service = scopedService(actionGeneration);
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
    await get().refreshPortfolio(portfolioId);
  },

  reorderItems: async (portfolioId: string, itemIds: string[]) => {
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, portfolioId);
    const service = scopedService(actionGeneration);
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
      const reordered = itemIds.map((id) => itemById.get(id)).filter(Boolean) as PortfolioItem[];
      return {
        items: { ...state.items, [portfolioId]: reordered },
      };
    });
    await get().refreshPortfolio(portfolioId);
  },

  addCollaborator: async (portfolioId: string, userId: string, role: "viewer" | "editor") => {
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, portfolioId);
    const service = scopedService(actionGeneration);
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
    const actionGeneration = generation;
    await ensurePortfolioFresh(get, set, portfolioId);
    const service = scopedService(actionGeneration);
    await service.portfolio.removePortfolioCollaborator(
      portfolioId,
      userId,
      getPortfolioMutationOptions(get().portfolios, portfolioId),
    );
    set((state) => ({
      collaborators: {
        ...state.collaborators,
        [portfolioId]: (state.collaborators[portfolioId] ?? []).filter((c) => c.userId !== userId),
      },
    }));
    await get().refreshPortfolio(portfolioId);
  },

  followPortfolio: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.portfolio.followPortfolio(portfolioId);
    set((state) => ({
      follows: { ...state.follows, [portfolioId]: true },
    }));
    trackAnalyticsEvent(
      "portfolio_followed",
      { portfolio_id: portfolioId },
      { userId: getAnalyticsUserId() },
    );
  },

  unfollowPortfolio: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.portfolio.unfollowPortfolio(portfolioId);
    set((state) => ({
      follows: { ...state.follows, [portfolioId]: false },
    }));
  },

  flagPortfolio: async (portfolioId: string, reason: string, details?: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.portfolio.flagPortfolio(portfolioId, reason, details);
    trackAnalyticsEvent(
      "portfolio_flagged",
      { portfolio_id: portfolioId, reason },
      { userId: getAnalyticsUserId() },
    );
  },

  searchPortfolios: async (query: string, filters?: { type?: string; visibility?: string }) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    return await service.portfolio.searchPortfolios(query, filters);
  },

  refreshPortfolio: async (portfolioId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    const portfolio = await service.portfolio.getPortfolio(portfolioId);
    set((state) => ({
      portfolios: [portfolio, ...state.portfolios.filter((entry) => entry.id !== portfolioId)].sort(
        (left, right) => right.updatedAt.localeCompare(left.updatedAt),
      ),
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

  _reset: () => {
    generation++;
    set({
      portfolios: [],
      items: {},
      collaborators: {},
      follows: {},
      followerCounts: {},
      conflicts: {},
      isLoaded: false,
    });
  },
}));
