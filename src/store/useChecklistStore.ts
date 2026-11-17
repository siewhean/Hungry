import { create } from "zustand";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import type { Checklist, ChecklistItem } from "@/types/domain";
import type { ChecklistItemCreateInput } from "@/lib/services/types";

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

interface ChecklistState {
  checklists: Checklist[];
  items: Record<string, ChecklistItem[]>;
  isLoaded: boolean;

  loadChecklists: () => Promise<void>;
  loadChecklistItems: (checklistId: string) => Promise<void>;

  createChecklist: (name: string) => Promise<Checklist>;
  updateChecklist: (id: string, name: string) => Promise<void>;
  deleteChecklist: (id: string) => Promise<void>;

  addItem: (input: ChecklistItemCreateInput) => Promise<ChecklistItem>;
  updateItem: (id: string, updates: Partial<ChecklistItemCreateInput>) => Promise<void>;
  markItemTried: (id: string, tried?: boolean) => Promise<void>;
  deleteItem: (id: string, checklistId: string) => Promise<void>;
  reorderItems: (checklistId: string, itemIds: string[]) => Promise<void>;

  _reset: () => void;
}

function getAnalyticsUserId(): string | undefined {
  return useProfileStore.getState().profile.id;
}

function isSameChecklistTarget(item: ChecklistItem, input: ChecklistItemCreateInput): boolean {
  if (item.itemType !== input.itemType) return false;
  if (input.itemType === "dish") return item.dishId === input.dishId;
  if (input.itemType === "stall") return item.stallId === input.stallId;
  return false;
}

function assertCompleteReorder(
  checklistId: string,
  currentItems: ChecklistItem[],
  itemIds: string[],
): void {
  const currentIds = new Set(currentItems.map((item) => item.id));
  const requestedIds = new Set(itemIds);
  const hasMissing = currentItems.some((item) => !requestedIds.has(item.id));
  const hasUnknown = itemIds.some((id) => !currentIds.has(id));
  if (hasMissing || hasUnknown || requestedIds.size !== itemIds.length) {
    throw new Error(`Checklist ${checklistId} reorder requires every current item exactly once`);
  }
}

export const useChecklistStore = create<ChecklistState>()((set, get) => ({
  checklists: [],
  items: {},
  isLoaded: false,

  loadChecklists: async () => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const checklists = await service.checklist.getChecklists();
      set({ checklists, isLoaded: true });
    } catch (error) {
      throw error;
    }
  },

  loadChecklistItems: async (checklistId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    try {
      const items = await service.checklist.getChecklistItems(checklistId);
      set((state) => ({
        items: { ...state.items, [checklistId]: items },
      }));
    } catch (error) {
      throw error;
    }
  },

  createChecklist: async (name: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    const checklist = await service.checklist.createChecklist(name);
    set((state) => ({
      checklists: [...state.checklists, checklist],
    }));
    trackAnalyticsEvent(
      "checklist_created",
      { checklist_id: checklist.id },
      { userId: getAnalyticsUserId() },
    );
    return checklist;
  },

  updateChecklist: async (id: string, name: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.checklist.updateChecklist(id, name);
    set((state) => ({
      checklists: state.checklists.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  },

  deleteChecklist: async (id: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.checklist.deleteChecklist(id);
    set((state) => ({
      checklists: state.checklists.filter((c) => c.id !== id),
      items: Object.fromEntries(Object.entries(state.items).filter(([key]) => key !== id)),
    }));
  },

  addItem: async (input: ChecklistItemCreateInput) => {
    const actionGeneration = generation;
    if (input.itemType !== "custom" && !get().items[input.checklistId]) {
      await get().loadChecklistItems(input.checklistId);
    }
    const currentItems = get().items[input.checklistId] ?? [];
    if (currentItems.some((item) => isSameChecklistTarget(item, input))) {
      throw new Error("This item is already in the checklist");
    }
    const service = scopedService(actionGeneration);
    const item = await service.checklist.addChecklistItem(input);
    set((state) => ({
      items: {
        ...state.items,
        [input.checklistId]: [...(state.items[input.checklistId] || []), item],
      },
    }));
    trackAnalyticsEvent(
      "checklist_item_added",
      {
        checklist_id: input.checklistId,
        item_type: input.itemType,
        dish_id: input.dishId,
        stall_id: input.stallId,
      },
      { userId: getAnalyticsUserId() },
    );
    return item;
  },

  updateItem: async (id: string, updates: Partial<ChecklistItemCreateInput>) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.checklist.updateChecklistItem(id, updates);
    set((state) => {
      const newItems = { ...state.items };
      for (const checklistId in newItems) {
        newItems[checklistId] = newItems[checklistId].map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                reminderAt:
                  updates.reminderAt === undefined
                    ? item.reminderAt
                    : (updates.reminderAt ?? undefined),
                plannedVisitDate:
                  updates.plannedVisitDate === undefined
                    ? item.plannedVisitDate
                    : (updates.plannedVisitDate ?? undefined),
              }
            : item,
        );
      }
      return { items: newItems };
    });
  },

  markItemTried: async (id: string, tried = true) => {
    const actionGeneration = generation;
    const existingItem = Object.values(get().items)
      .flat()
      .find((item) => item.id === id);
    const service = scopedService(actionGeneration);
    await service.checklist.setChecklistItemTried(id, tried);
    const triedAt = tried ? (existingItem?.triedAt ?? new Date().toISOString()) : undefined;
    set((state) => {
      const newItems = { ...state.items };
      for (const checklistId in newItems) {
        newItems[checklistId] = newItems[checklistId].map((item) =>
          item.id === id ? { ...item, triedAt } : item,
        );
      }
      return { items: newItems };
    });
    if (tried && existingItem && !existingItem.triedAt) {
      trackAnalyticsEvent(
        "checklist_item_tried",
        {
          checklist_id: existingItem?.checklistId,
          item_type: existingItem?.itemType,
          dish_id: existingItem?.dishId,
          stall_id: existingItem?.stallId,
        },
        { userId: getAnalyticsUserId() },
      );
    }
  },

  deleteItem: async (id: string, checklistId: string) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    await service.checklist.deleteChecklistItem(id);
    set((state) => ({
      items: {
        ...state.items,
        [checklistId]: (state.items[checklistId] ?? []).filter((item) => item.id !== id),
      },
    }));
  },

  reorderItems: async (checklistId: string, itemIds: string[]) => {
    const actionGeneration = generation;
    const service = scopedService(actionGeneration);
    const items = get().items[checklistId] || [];
    assertCompleteReorder(checklistId, items, itemIds);
    await service.checklist.reorderChecklistItems(checklistId, itemIds);
    set((state) => {
      const items = state.items[checklistId] || [];
      const itemById = new Map(items.map((item) => [item.id, item]));
      const reordered = itemIds.map((id) => itemById.get(id)).filter(Boolean) as ChecklistItem[];
      return {
        items: { ...state.items, [checklistId]: reordered },
      };
    });
  },

  _reset: () => {
    generation++;
    set({ checklists: [], items: {}, isLoaded: false });
  },
}));
