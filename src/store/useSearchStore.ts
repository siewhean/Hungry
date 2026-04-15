import { create } from "zustand";
import { persist } from "zustand/middleware";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type {
  DietaryFlag,
  SearchCategory,
  SearchFilters,
  TasteVector,
} from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

const MAX_RECENT_SEARCHES = 5;

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

interface SearchState {
  filters: SearchFilters;
  recentSearches: string[];
  updateQuery: (query: string) => void;
  toggleCategory: (category: SearchCategory) => void;
  toggleDietary: (flag: DietaryFlag) => void;
  setTasteValues: (tasteValues: TasteVector) => void;
  resetToProfile: (tasteValues: TasteVector) => void;
  rememberSearch: (query: string) => void;
  clearSearchState: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      filters: {
        query: "",
        categories: [],
        dietaryFlags: [],
        tasteValues: NEUTRAL_TASTE_VECTOR,
        radius: 1000,
      },
      recentSearches: [],
      updateQuery: (query) =>
        set((state) => ({
          filters: {
            ...state.filters,
            query,
          },
        })),
      toggleCategory: (category) =>
        set((state) => {
          const selected = !state.filters.categories.includes(category);
          trackAnalyticsEvent("category_chip_tapped", {
            category,
            selected,
          });
          return {
            filters: {
              ...state.filters,
              categories: state.filters.categories.includes(category)
                ? state.filters.categories.filter((value) => value !== category)
                : [...state.filters.categories, category],
            },
          };
        }),
      toggleDietary: (flag) =>
        set((state) => {
          const selected = !state.filters.dietaryFlags.includes(flag);
          trackAnalyticsEvent("dietary_chip_tapped", {
            flag,
            selected,
          });
          return {
            filters: {
              ...state.filters,
              dietaryFlags: state.filters.dietaryFlags.includes(flag)
                ? state.filters.dietaryFlags.filter((value) => value !== flag)
                : [...state.filters.dietaryFlags, flag],
            },
          };
        }),
      setTasteValues: (tasteValues) =>
        set((state) => {
          trackAnalyticsEvent("taste_filter_applied", {
            source: "set_taste_values",
          });
          return {
            filters: {
              ...state.filters,
              tasteValues,
            },
          };
        }),
      resetToProfile: (tasteValues) =>
        set((state) => {
          trackAnalyticsEvent("taste_filter_applied", {
            source: "reset_to_profile",
          });
          return {
            filters: {
              ...state.filters,
              tasteValues,
            },
          };
        }),
      rememberSearch: (query) =>
        set((state) => {
          const normalizedQuery = normalizeSearchQuery(query);
          if (!normalizedQuery) {
            return state;
          }

          trackAnalyticsEvent("search_submitted", {
            query_length: normalizedQuery.length,
          });

          return {
            recentSearches: [
              normalizedQuery,
              ...state.recentSearches.filter(
                (value) =>
                  value.toLowerCase() !== normalizedQuery.toLowerCase(),
              ),
            ].slice(0, MAX_RECENT_SEARCHES),
          };
        }),
      clearSearchState: () =>
        set({
          filters: {
            query: "",
            categories: [],
            dietaryFlags: [],
            tasteValues: NEUTRAL_TASTE_VECTOR,
            radius: 1000,
          },
          recentSearches: [],
        }),
    }),
    {
      name: "hungry-search-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        filters: state.filters,
        recentSearches: state.recentSearches,
      }),
    },
  ),
);
