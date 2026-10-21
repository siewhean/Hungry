import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import {
  ArrowLeft,
  History,
  MapPin,
  Search as SearchIcon,
  Store,
  Utensils,
  X,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, ChipGroup, IconButton, Input, Screen } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { CATALOG_SUGGEST_MIN_CHARS, type CatalogSuggestion } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

// The paged catalog request maps only these categories into a cuisine filter,
// so other chips would do nothing.
const CATALOG_CATEGORIES: SearchCategory[] = ["noodles", "rice"];
const CATEGORY_OPTIONS = CATALOG_CATEGORIES.map((category) => ({
  id: category,
  label: category.replace(/\b\w/g, (char) => char.toUpperCase()),
}));
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type BrowseMode = "dishes" | "stalls";

const SUGGESTION_KIND_LABELS: Record<CatalogSuggestion["kind"], string> = {
  food_type: "Dish type",
  place: "Mall, hawker centre or food court",
  stall: "Stall",
};
const SUGGEST_DEBOUNCE_MS = 200;

/** Food types open dish results; stalls and places open stall results. */
function suggestionMode(suggestion: CatalogSuggestion): BrowseMode {
  return suggestion.kind === "food_type" ? "dishes" : "stalls";
}

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { motion, palette, spacing } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const recentSearches = useSearchStore((state) => state.recentSearches);
  const clearSearchHistory = useSearchStore((state) => state.clearSearchHistory);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  // Query and category live here and travel as route params, so nothing stale is persisted.
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | undefined>();
  // Search results own the paged catalog request; this landing screen stays
  // free of local recommendations so it never hydrates the whole catalog.
  const entryY = useRef(new Animated.Value(reduceMotion ? 0 : -28)).current;
  const entryOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const trimmedSearchText = searchText.trim();
  // Suggestions are kept with the text they answer, so stale ones never show.
  const [suggestionResult, setSuggestionResult] = useState<{
    query: string;
    items: CatalogSuggestion[];
  }>({ query: "", items: [] });
  const [popularFoodTypes, setPopularFoodTypes] = useState<CatalogSuggestion[]>([]);
  const showSuggestions = trimmedSearchText.length >= CATALOG_SUGGEST_MIN_CHARS;
  const suggestions = suggestionResult.query === trimmedSearchText ? suggestionResult.items : [];

  // Popular food types fill the empty state; suggestions follow the text as it is typed.
  useEffect(() => {
    let active = true;
    getCatalogRawService()
      .suggest("")
      .then((items) => {
        if (active) setPopularFoodTypes(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showSuggestions) return;
    let active = true;
    const timer = setTimeout(() => {
      getCatalogRawService()
        .suggest(trimmedSearchText)
        .then((items) => {
          if (active) setSuggestionResult({ query: trimmedSearchText, items });
        })
        .catch(() => undefined);
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showSuggestions, trimmedSearchText]);

  useEffect(() => {
    if (reduceMotion) {
      entryY.setValue(0);
      entryOpacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryY, motion.screenTransition, reduceMotion]);

  const openResults = (query: string, browseMode?: BrowseMode) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      rememberSearch(trimmedQuery);
    }
    navigation.navigate("SearchResults", {
      browseMode,
      initialQuery: trimmedQuery || undefined,
      foodTypeTag: selectedCategory,
    });
  };

  const openSuggestion = (suggestion: CatalogSuggestion, surface: "typeahead" | "popular") => {
    trackAnalyticsEvent("search_suggestion_opened", { kind: suggestion.kind, surface });
    setSearchText(suggestion.label);
    if (suggestion.kind === "place" && suggestion.placeId) {
      // A place shows only the stalls inside that building, not every fuzzy name match.
      rememberSearch(suggestion.label);
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        placeId: suggestion.placeId,
        placeName: suggestion.label,
      });
      return;
    }
    openResults(suggestion.label, suggestionMode(suggestion));
  };

  const showRecents = allowSearchHistory && recentSearches.length > 0;

  return (
    <Screen>
      <Animated.View
        style={{
          gap: spacing[4],
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[3],
          }}
        >
          <IconButton
            variant="ghost"
            accessibilityLabel="Go back"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate("MainTabs", { screen: "Discover" });
            }}
            icon={<ArrowLeft color={palette.text} size={18} />}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Search</AppText>
          </View>
        </View>

        <Input
          autoFocus
          leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
          rightIcon={
            searchText ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={12}
                onPress={() => setSearchText("")}
              >
                <X color={palette.textMuted} size={18} />
              </Pressable>
            ) : undefined
          }
          placeholder="Laksa, satay, Tian Tian..."
          accessibilityLabel="Search dishes, stalls, or hawker centres"
          returnKeyType="search"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => openResults(searchText)}
        />
        {showSuggestions && suggestions.length > 0 ? (
          <View accessibilityLabel="Suggestions" style={{ gap: spacing[1] }}>
            {suggestions.map((suggestion) => {
              const Icon =
                suggestion.kind === "food_type"
                  ? Utensils
                  : suggestion.kind === "place"
                    ? MapPin
                    : Store;
              return (
                <Pressable
                  key={`${suggestion.kind}:${suggestion.label}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${suggestion.label}, ${SUGGESTION_KIND_LABELS[suggestion.kind]}`}
                  onPress={() => openSuggestion(suggestion, "typeahead")}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing[3],
                    minHeight: 44,
                  }}
                >
                  <Icon color={palette.textMuted} size={18} />
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1}>{suggestion.label}</AppText>
                    <AppText tone="secondary" variant="micro">
                      {SUGGESTION_KIND_LABELS[suggestion.kind]}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <ChipGroup
          options={CATEGORY_OPTIONS}
          selectedIds={selectedCategory ? [selectedCategory] : []}
          onSelect={(category) => {
            const next = selectedCategory === category ? undefined : category;
            setSelectedCategory(next);
            trackAnalyticsEvent("category_chip_tapped", { category, selected: Boolean(next) });
          }}
        />
        {showRecents ? (
          <View style={{ gap: spacing[2] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="bodyBold" accessibilityRole="header">
                Recent searches
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear recent searches"
                hitSlop={12}
                onPress={clearSearchHistory}
              >
                <AppText tone="secondary" variant="bodySmall">
                  Clear
                </AppText>
              </Pressable>
            </View>
            {recentSearches.map((query) => (
              <Pressable
                key={query}
                accessibilityRole="button"
                accessibilityLabel={`Search ${query} again`}
                onPress={() => {
                  setSearchText(query);
                  openResults(query);
                }}
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 44,
                }}
              >
                <History color={palette.textMuted} size={18} />
                <AppText numberOfLines={1} style={{ flex: 1 }}>
                  {query}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!trimmedSearchText && popularFoodTypes.length > 0 ? (
          <View style={{ gap: spacing[2] }}>
            <AppText variant="bodyBold" accessibilityRole="header">
              Popular dishes
            </AppText>
            <ChipGroup
              options={popularFoodTypes.map((item) => ({ id: item.label, label: item.label }))}
              onSelect={(label) => {
                const suggestion = popularFoodTypes.find((item) => item.label === label);
                if (suggestion) openSuggestion(suggestion, "popular");
              }}
            />
          </View>
        ) : null}
        <Button
          label={trimmedSearchText ? "See all results" : "View search results"}
          onPress={() => openResults(searchText)}
        />
      </Animated.View>
    </Screen>
  );
}
