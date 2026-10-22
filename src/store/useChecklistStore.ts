import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useProfileStore } from "@/store/useProfileStore";
import type { Checklist, ChecklistItem } from "@/types/domain";
import type { ChecklistItemCreateInput } from "@/lib/services/types";

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

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set, get) => ({
      checklists: [],
      items: {},
      isLoaded: false,

      loadChecklists: async () => {
        const service = getHungryService();
        try {
          const checklists = await service.checklist.getChecklists();
          set({ checklists, isLoaded: true });
        } catch (error) {
          if (get().checklists.length > 0) {
            set({ isLoaded: true });
            return;
          }
          throw error;
        }
      },

      loadChecklistItems: async (checklistId: string) => {
        const service = getHungryService();
        try {
          const items = await service.checklist.getChecklistItems(checklistId);
          set((state) => ({
            items: { ...state.items, [checklistId]: items },
          }));
        } catch (error) {
          if (get().items[checklistId]) {
            return;
          }
          throw error;
        }
      },

      createChecklist: async (name: string) => {
        const service = getHungryService();
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
        const service = getHungryService();
        await service.checklist.updateChecklist(id, name);
        set((state) => ({
          checklists: state.checklists.map((c) => (c.id === id ? { ...c, name } : c)),
        }));
      },

      deleteChecklist: async (id: string) => {
        const service = getHungryService();
        await service.checklist.deleteChecklist(id);
        set((state) => ({
          checklists: state.checklists.filter((c) => c.id !== id),
          items: Object.fromEntries(Object.entries(state.items).filter(([key]) => key !== id)),
        }));
      },

      addItem: async (input: ChecklistItemCreateInput) => {
        if (input.itemType !== "custom" && !get().items[input.checklistId]) {
          await get().loadChecklistItems(input.checklistId);
        }
        const currentItems = get().items[input.checklistId] ?? [];
        if (currentItems.some((item) => isSameChecklistTarget(item, input))) {
          throw new Error("This item is already in the checklist");
        }
        const service = getHungryService();
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
        const service = getHungryService();
        await service.checklist.updateChecklistItem(id, updates);
        set((state) => {
          const newItems = { ...state.items };
          for (const checklistId in newItems) {
            newItems[checklistId] = newItems[checklistId].map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            );
          }
          return { items: newItems };
        });
      },

      markItemTried: async (id: string, tried = true) => {
        const existingItem = Object.values(get().items)
          .flat()
          .find((item) => item.id === id);
        const service = getHungryService();
        await service.checklist.markChecklistItemTried(id, tried);
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
        const service = getHungryService();
        await service.checklist.deleteChecklistItem(id);
        set((state) => ({
          items: {
            ...state.items,
            [checklistId]: (state.items[checklistId] ?? []).filter((item) => item.id !== id),
          },
        }));
        trackAnalyticsEvent(
          "list_item_removed",
          { list_kind: "checklist", list_id: checklistId },
          { userId: getAnalyticsUserId() },
        );
      },

      reorderItems: async (checklistId: string, itemIds: string[]) => {
        const service = getHungryService();
        const items = get().items[checklistId] || [];
        assertCompleteReorder(checklistId, items, itemIds);
        await service.checklist.reorderChecklistItems(checklistId, itemIds);
        set((state) => {
          const items = state.items[checklistId] || [];
          const itemById = new Map(items.map((item) => [item.id, item]));
          const reordered = itemIds
            .map((id) => itemById.get(id))
            .filter(Boolean) as ChecklistItem[];
          return {
            items: { ...state.items, [checklistId]: reordered },
          };
        });
      },

      _reset: () => set({ checklists: [], items: {}, isLoaded: false }),
    }),
    {
      name: "checklist-storage",
      storage: hungryPersistStorage,
      partialize: (state) => ({ checklists: state.checklists, items: state.items }),
    },
  ),
);
