import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, TextInput, View } from "react-native";
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  History,
  MapPin,
  Search as SearchIcon,
  SlidersHorizontal,
  Store,
  Utensils,
  X,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  IconButton,
  Input,
  Screen,
} from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  CATALOG_SUGGEST_MIN_CHARS,
  type CatalogRawDishCard,
  type CatalogSuggestion,
} from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
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
  const { componentRadii, motion, palette, radii, shadows, spacing } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const recentSearches = useSearchStore((state) => state.recentSearches);
  const clearSearchHistory = useSearchStore((state) => state.clearSearchHistory);
  const removeRecentSearch = useSearchStore((state) => state.removeRecentSearch);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  // Query and category live here and travel as route params, so nothing stale is persisted.
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<TextInput | null>(null);
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
  const [featuredDishes, setFeaturedDishes] = useState<CatalogRawDishCard[]>([]);
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
    let active = true;
    getCatalogRawService()
      .listDishes({ limit: 3, sort: "quality" })
      .then((page) => {
        if (active) setFeaturedDishes(page.items);
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
    // The results grid saves a submitted query as a recent search, once it commits it.
    const trimmedQuery = query.trim();
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

  const quickFilter = (filter?: string) =>
    navigation.navigate("SearchResults", { browseMode: "dishes", initialFilter: filter });

  return (
    // "handled" lets the clear (x) work on the first tap while the keyboard is up.
    <Screen contentContainerStyle={{ paddingTop: spacing[2] }}>
      <Animated.View
        style={{
          gap: spacing[5],
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          <IconButton
            variant="ghost"
            accessibilityLabel="Go back to Discover"
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
            <Input
              ref={searchInputRef}
              autoFocus
              leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
              rightIcon={
                searchText ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={12}
                    onPress={() => {
                      setSearchText("");
                      // Keep the user typing: clearing should not drop focus/keyboard.
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X color={palette.textMuted} size={18} />
                  </Pressable>
                ) : undefined
              }
              placeholder="Try laksa, chicken rice, halal under $8"
              accessibilityLabel="Search dishes, stalls, or hawker centres"
              returnKeyType="search"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={() => openResults(searchText)}
            />
          </View>
        </View>
        {!trimmedSearchText ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {[
              {
                label: "Near Me",
                filter: undefined,
                icon: <MapPin color={palette.textOnPrimary} size={16} />,
                primary: true,
              },
              {
                label: "Under S$6",
                filter: "Under S$6",
                icon: <AppText style={{ color: palette.orange }}>S$</AppText>,
              },
              {
                label: "Halal",
                filter: "Halal",
                icon: <AppText style={{ color: palette.success }}>✓</AppText>,
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={`Search ${item.label.toLowerCase()} dishes`}
                onPress={() => quickFilter(item.filter)}
                style={[
                  shadows.card,
                  {
                    alignItems: "center",
                    backgroundColor: item.primary ? palette.orange : palette.surface,
                    borderRadius: radii.pill,
                    flexDirection: "row",
                    gap: spacing[2],
                    minHeight: 44,
                    paddingHorizontal: spacing[4],
                  },
                ]}
              >
                {item.icon}
                <AppText style={{ color: item.primary ? palette.textOnPrimary : palette.text }}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
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
        {trimmedSearchText ? (
          <ChipGroup
            options={CATEGORY_OPTIONS}
            selectedIds={selectedCategory ? [selectedCategory] : []}
            onSelect={(category) => {
              const next = selectedCategory === category ? undefined : category;
              setSelectedCategory(next);
              trackAnalyticsEvent("category_chip_tapped", { category, selected: Boolean(next) });
            }}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tune your taste profile"
            onPress={() => {
              if (isAuthenticated) {
                navigation.navigate("OnboardingStack", {
                  screen: "TasteQuiz",
                  params: { mode: "profile" },
                });
                return;
              }
              navigation.navigate("MainTabs", {
                screen: "Profile",
                params: { screen: "ProfileHome" },
              });
            }}
            style={[
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                padding: spacing[4],
              },
            ]}
          >
            <View
              style={{
                backgroundColor: palette.orangeLight,
                borderRadius: radii.md,
                padding: spacing[3],
              }}
            >
              <SlidersHorizontal color={palette.orange} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Tune your palate</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Set how much spice, sweetness and richness you enjoy
              </AppText>
            </View>
            <ChevronRight color={palette.textMuted} size={20} />
          </Pressable>
        )}
        {showRecents ? (
          <View style={{ gap: spacing[2] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="h2" accessibilityRole="header">
                Recent Searches
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear recent searches"
                hitSlop={12}
                onPress={clearSearchHistory}
              >
                <AppText tone="secondary" variant="bodySmall">
                  Clear All
                </AppText>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {recentSearches.map((query) => (
                <View
                  key={query}
                  style={[
                    shadows.card,
                    {
                      alignItems: "center",
                      backgroundColor: palette.surface,
                      borderRadius: radii.pill,
                      flexDirection: "row",
                      paddingLeft: spacing[3],
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${query} again`}
                    onPress={() => {
                      setSearchText(query);
                      openResults(query);
                    }}
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      gap: spacing[2],
                      minHeight: 44,
                    }}
                  >
                    <History color={palette.textMuted} size={18} />
                    <AppText numberOfLines={1}>{query}</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${query} from recent searches`}
                    hitSlop={4}
                    onPress={() => removeRecentSearch(query)}
                    style={{
                      alignItems: "center",
                      height: 44,
                      justifyContent: "center",
                      width: 36,
                    }}
                  >
                    <X color={palette.textMuted} size={16} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {!trimmedSearchText && popularFoodTypes.length > 0 ? (
          <View accessibilityLabel="Popular dishes" style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="h2" accessibilityRole="header">
                Hawker Classics
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                Quick Find
              </AppText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[2] }}
            >
              {popularFoodTypes.slice(0, 6).map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${item.label}`}
                  onPress={() => openSuggestion(item, "popular")}
                  style={[
                    shadows.card,
                    {
                      alignItems: "center",
                      backgroundColor: palette.surface,
                      borderRadius: componentRadii.card,
                      flexDirection: "row",
                      gap: spacing[3],
                      minHeight: 56,
                      paddingHorizontal: spacing[3],
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: palette.orangeLight,
                      borderRadius: radii.md,
                      padding: spacing[2],
                    }}
                  >
                    <Utensils color={palette.orange} size={20} />
                  </View>
                  <AppText variant="bodyBold">{item.label}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {!trimmedSearchText && featuredDishes.length > 0 ? (
          <View style={{ gap: spacing[3] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                <Flame color={palette.orange} size={20} />
                <AppText variant="h2" accessibilityRole="header">
                  Dishes to Discover
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all dishes"
                onPress={() => openResults("")}
              >
                <ChevronRight color={palette.textMuted} size={20} />
              </Pressable>
            </View>
            {featuredDishes.map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${dish.name} from ${dish.venueName}`}
                onPress={() =>
                  navigation.navigate("CatalogRawDetail", { kind: "dish", id: dish.id })
                }
                style={[
                  shadows.card,
                  {
                    alignItems: "center",
                    backgroundColor: palette.surface,
                    borderRadius: componentRadii.card,
                    flexDirection: "row",
                    gap: spacing[3],
                    padding: spacing[3],
                  },
                ]}
              >
                {dish.imageUrl ? (
                  <AccessibleImage
                    source={{ uri: dish.imageUrl }}
                    accessibilityLabel={dish.name}
                    contentFit="cover"
                    style={{ borderRadius: radii.md, height: 88, width: 88 }}
                  />
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: palette.orangeLight,
                      borderRadius: radii.md,
                      height: 88,
                      justifyContent: "center",
                      width: 88,
                    }}
                  >
                    <Utensils color={palette.orange} size={28} />
                  </View>
                )}
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {dish.name}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {dish.venueName}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.buildingName || "Singapore"}
                    {dish.distanceMeters != null ? ` · ${Math.round(dish.distanceMeters)}m` : ""}
                  </AppText>
                  {dish.rating != null ? (
                    <AppText variant="micro" style={{ color: palette.ratingStar }}>
                      ★ {dish.rating.toFixed(1)}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing[4] }}>
                  {dish.price != null ? (
                    <AppText variant="bodyBold" style={{ color: palette.orange }}>
                      S${dish.price.toFixed(2)}
                    </AppText>
                  ) : null}
                  <ChevronRight color={palette.textMuted} size={18} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Button
          label={trimmedSearchText ? "See all results" : "Browse dishes near you"}
          onPress={() => openResults(searchText)}
        />
      </Animated.View>
    </Screen>
  );
}
