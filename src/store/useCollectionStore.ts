/**
 * useCollectionStore — Food Collections (curated lists of stalls)
 *
 * Phase 1: Read-only access to Hungry-official collections.
 * Phase 2: User-created collections with CRUD operations.
 *
 * Production swap:
 *   1. Replace `loadCollections()` with Supabase query on `food_collections`.
 *   2. Replace `saveCollection()` with Supabase upsert on `user_collection_saves`.
 *   3. Add `createCollection()` + `addStallToCollection()` for Phase 2.
 */

import { create } from "zustand";
import { useProfileStore } from "@/store/useProfileStore";
import { getHungryService, getDataRepository } from "@/lib/services/serviceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { CollectionItem, FoodCollection } from "@/types/domain";

// ─── State Interface ──────────────────────────────────────────────────────────

interface CollectionState {
  collections: FoodCollection[];
  /** Map of collectionId → CollectionItem[] for loaded detail views */
  itemCache: Record<string, CollectionItem[]>;
  /** Set of collectionIds the current user has saved */
  savedCollectionIds: Set<string>;
  isLoaded: boolean;

  // Queries
  getFeaturedCollections: () => FoodCollection[];
  getCollectionById: (collectionId: string) => FoodCollection | null;
  getCollectionItems: (collectionId: string) => CollectionItem[];
  isSaved: (collectionId: string) => boolean;

  // Actions
  loadCollections: () => Promise<void>;
  loadCollectionItems: (collectionId: string) => Promise<CollectionItem[]>;
  toggleSaveCollection: (userId: string, collectionId: string) => Promise<void>;
  _reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

let generation = 0;
let loadRequest = 0;
let mutationRevision = 0;
const pendingSaves = new Set<string>();

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  collections: [],
  itemCache: {},
  savedCollectionIds: new Set(),
  isLoaded: false,

  getFeaturedCollections: () => get().collections.filter((c) => c.isFeatured),

  getCollectionById: (collectionId) => get().collections.find((c) => c.id === collectionId) ?? null,

  getCollectionItems: (collectionId) => get().itemCache[collectionId] ?? [],

  isSaved: (collectionId) => get().savedCollectionIds.has(collectionId),

  loadCollections: async () => {
    if (get().isLoaded) return;

    const epoch = generation;
    const request = ++loadRequest;
    // A save can finish while either snapshot is in flight. Reload both rather
    // than publishing an older saved set or guessing whether counts include it.
    while (epoch === generation && request === loadRequest) {
      const revision = mutationRevision;
      const repo = getDataRepository();
      const [saved, list] = await Promise.all([
        getHungryService().collections.listSavedCollectionIds(),
        repo.listCollections?.() ?? Promise.resolve([] as FoodCollection[]),
      ]);
      if (epoch !== generation || request !== loadRequest) return;
      if (revision !== mutationRevision) continue;
      set({ collections: list, savedCollectionIds: new Set(saved), isLoaded: true });
      return;
    }
  },

  loadCollectionItems: async (collectionId) => {
    // Return cache hit
    if (get().itemCache[collectionId]) return get().itemCache[collectionId];

    const repo = getDataRepository();
    const epoch = generation;
    const items: CollectionItem[] = (await repo.listCollectionItems?.(collectionId)) ?? [];

    if (epoch !== generation) return [];
    set((state) => ({
      itemCache: { ...state.itemCache, [collectionId]: items },
    }));

    return items;
  },

  toggleSaveCollection: async (userId, collectionId) => {
    if (userId !== useProfileStore.getState().profile.id)
      throw new Error("Account changed. Reopen collections.");
    if (pendingSaves.has(collectionId)) return;
    const epoch = generation;
    const wasSaved = get().savedCollectionIds.has(collectionId);
    pendingSaves.add(collectionId);
    try {
      await getHungryService().collections.setCollectionSaved(collectionId, !wasSaved);
      if (epoch !== generation || userId !== useProfileStore.getState().profile.id) return;
      mutationRevision++;
      set((state) => {
        const next = new Set(state.savedCollectionIds);
        if (wasSaved) next.delete(collectionId);
        else next.add(collectionId);
        return {
          savedCollectionIds: next,
          collections: state.collections.map((collection) =>
            collection.id === collectionId
              ? {
                  ...collection,
                  saveCount: Math.max(0, collection.saveCount + (wasSaved ? -1 : 1)),
                }
              : collection,
          ),
        };
      });
      trackAnalyticsEvent(wasSaved ? "collection_unsaved" : "collection_saved", {
        collection_id: collectionId,
        source_screen: "collections",
      });
    } finally {
      if (epoch === generation) pendingSaves.delete(collectionId);
    }
  },

  _reset: () => {
    generation++;
    loadRequest++;
    mutationRevision = 0;
    pendingSaves.clear();
    set({ collections: [], itemCache: {}, savedCollectionIds: new Set(), isLoaded: false });
  },
}));
