import { create } from "zustand";
import { persist } from "zustand/middleware";

import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import { hungryPersistStorage } from "./persistStorage";
import { useUIStore } from "./useUIStore";

const MAX_RECENT_SEARCHES = 5;

/** Settings > "Allow search history"; when off, searches are never written to history. */
function isSearchHistoryAllowed() {
  return useUIStore.getState().allowSearchHistory;
}

function normalizeSearchQuery(query: string) {
  return sanitizeSearchQuery(query);
}

interface SearchState {
  recentSearches: string[];
  /** Saves a committed search (Search home, or Enter in the results field) as a recent. */
  rememberSearch: (query: string) => void;
  /** Removes one recent search. */
  removeRecentSearch: (query: string) => void;
  /** Drops recent searches, e.g. when search history is turned off. */
  clearSearchHistory: () => void;
  clearSearchState: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      rememberSearch: (query) =>
        set((state) => {
          const normalizedQuery = normalizeSearchQuery(query);
          // Searches are counted by the results grid's single search_query event, not here.
          if (!normalizedQuery || !isSearchHistoryAllowed()) {
            return state;
          }

          return {
            recentSearches: [
              normalizedQuery,
              ...state.recentSearches.filter(
                (value) => value.toLowerCase() !== normalizedQuery.toLowerCase(),
              ),
            ].slice(0, MAX_RECENT_SEARCHES),
          };
        }),
      removeRecentSearch: (query) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter(
            (value) => value.toLowerCase() !== query.toLowerCase(),
          ),
        })),
      clearSearchHistory: () => set({ recentSearches: [] }),
      clearSearchState: () => set({ recentSearches: [] }),
    }),
    {
      name: "hungry-search-v1",
      // v2 dropped the unused filters and history that v1 wrote to storage.
      version: 2,
      storage: hungryPersistStorage,
      migrate: (persisted) => {
        const recent = (persisted as { recentSearches?: unknown } | undefined)?.recentSearches;
        return {
          recentSearches: Array.isArray(recent)
            ? recent
                .filter((value): value is string => typeof value === "string")
                .slice(0, MAX_RECENT_SEARCHES)
            : [],
        } as SearchState;
      },
      partialize: (state) => ({ recentSearches: state.recentSearches }),
    },
  ),
);
