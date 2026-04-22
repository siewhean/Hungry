import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, EmptyState, Screen, Chip, Card, Skeleton } from "@/components/ui";
import { SearchResultsView } from "@/components/discover/SearchResultsView";
import { findBuildingById } from "@/features/discovery/discovery";
import {
  getSearchResults,
  sortSearchResults,
  type SearchSortMode,
  useSearchData,
} from "@/features/search/search";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function SearchResultsScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { profile, filters } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const [sortMode, setSortMode] = useState<SearchSortMode>("best_match");
  const [isLoading, setIsLoading] = useState(true);
  const rawResults = useMemo(
    () => getSearchResults(filters, profile.tasteVector),
    [filters, profile.tasteVector],
  );
  const results = useMemo(
    () => sortSearchResults(rawResults, sortMode, profile.tasteVector),
    [profile.tasteVector, rawResults, sortMode],
  );

  return (
    <Screen scroll={false}>
      <SearchResultsView
        query={filters.query}
        onQueryChange={updateQuery}
        onClear={() => updateQuery("")}
        onTasteFilterPress={() => navigation.navigate("TasteFilter")}
        results={results}
        onResultPress={(dish) => {
          rememberSearch(filters.query);
          navigation.navigate("DishDetail", { dishId: dish.id });
        }}
      />
    </Screen>
  );
}
