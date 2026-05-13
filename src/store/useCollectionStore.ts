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
import { getDataRepository } from "@/lib/services/serviceProvider";
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

    const repo = getDataRepository();
    const list: FoodCollection[] = (await repo.listCollections?.()) ?? [];

    set({ collections: list, isLoaded: true });
  },

  loadCollectionItems: async (collectionId) => {
    // Return cache hit
    if (get().itemCache[collectionId]) return get().itemCache[collectionId];

    const repo = getDataRepository();
    const items: CollectionItem[] = (await repo.listCollectionItems?.(collectionId)) ?? [];

    set((state) => ({
      itemCache: { ...state.itemCache, [collectionId]: items },
    }));

    return items;
  },

  toggleSaveCollection: async (userId, collectionId) => {
    const wasSaved = get().savedCollectionIds.has(collectionId);

    set((state) => {
      const next = new Set(state.savedCollectionIds);
      if (wasSaved) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return { savedCollectionIds: next };
    });

    // Optimistically update saveCount on the collection object
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId ? { ...c, saveCount: c.saveCount + (wasSaved ? -1 : 1) } : c,
      ),
    }));

    trackAnalyticsEvent(wasSaved ? "collection_unsaved" : "collection_saved", {
      collection_id: collectionId,
      source_screen: "collections",
    });

    // TODO (production): supabase.from('user_collection_saves').upsert / .delete
  },

  _reset: () =>
    set({ collections: [], itemCache: {}, savedCollectionIds: new Set(), isLoaded: false }),
}));
