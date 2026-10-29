import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, ScrollView, TextInput, View, Text } from "react-native";
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
  ChipGroup,
  IconButton,
  Input,
  Screen,
  Skeleton,
} from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  getExperimentVariant,
  isExperimentAssignmentReady,
  onExperimentFlagsChange,
  useExperimentVariant,
} from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { formatBrowseDistance } from "@/features/search/browseGrid";
import { ResultsNotes } from "@/features/search/ResultsNotes";
import { useTypeaheadMatches } from "@/features/search/useTypeaheadMatches";
import {
  CATALOG_SUGGEST_MIN_CHARS,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
  type CatalogSuggestion,
} from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
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
type SearchHomeSource = "search_typed" | "search_recent" | "search_suggestion" | "search_featured";

/** search_home_featured_v1 "near": the best dishes within this distance of the user. */
const FEATURED_NEAR_RADIUS_METERS = 1_500;
/** Below this many nearby dishes the "near" arm shows the island-wide list, like control. */
const FEATURED_NEAR_MIN_ITEMS = 3;
/** How long Search home waits for flags before showing the island-wide list outside the test. */
const FEATURED_FLAG_WAIT_MS = 1_500;

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

/** Moves through these like the Discover search bar. */
const DISH_SEARCH_PLACEHOLDER_PHRASES = [
  "Try laksa or chicken rice",
  "Search for mee pok",
  "Stalls or hawker centres",
  "What's near you?",
];

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, motion, palette, radii, shadows, spacing } = useHungryTheme();
  const reduceMotion = useReduceMotion();
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
  const entryOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const trimmedSearchText = searchText.trim();
  // Suggestions are kept with the text they answer, so stale ones never show.
  const [suggestionResult, setSuggestionResult] = useState<{
    query: string;
    items: CatalogSuggestion[];
  }>({ query: "", items: [] });
  const [popularFoodTypes, setPopularFoodTypes] = useState<CatalogSuggestion[]>([]);
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  // The featured list is kept with the arm it was fetched for, so a flag load never shows one
  // arm's list as the other's.
  const [featured, setFeatured] = useState<{
    arm: string;
    items: CatalogRawDishCard[];
    releaseId?: string;
    settled: boolean;
  }>({ arm: "", items: [], settled: false });
  // One report per mount for each Search home load, not one per retry.
  const reportedLoadsRef = useRef(new Set<string>());
  const reportLoadError = useCallback((load: string, error: unknown) => {
    if (reportedLoadsRef.current.has(load)) return;
    reportedLoadsRef.current.add(load);
    reportError(error, { surface: "search_home", load });
  }, []);
  const showSuggestions = trimmedSearchText.length >= CATALOG_SUGGEST_MIN_CHARS;
  const suggestions = suggestionResult.query === trimmedSearchText ? suggestionResult.items : [];
  const suggestionsLoading = showSuggestions && suggestionResult.query !== trimmedSearchText;
  const matches = useTypeaheadMatches(trimmedSearchText, showSuggestions);

  // Popular food types fill the empty state; suggestions follow the text as it is typed.
  useEffect(() => {
    let active = true;
    getCatalogRawService()
      .suggest("")
      .then((items) => {
        if (active) setPopularFoodTypes(items);
      })
      .catch((error) => reportLoadError("popular_food_types", error));
    return () => {
      active = false;
    };
  }, [reportLoadError]);

  // The arm is peeked (no exposure) to choose what to fetch; exposure waits until the
  // section is on screen. Both arms end with a list, so eligibility never depends on the arm.
  // The arm is decided once per visit, after flags have loaded (or a short wait runs out), so
  // a late flag load never swaps the list on screen or exposes an arm nobody saw.
  const [flagsReady, setFlagsReady] = useState(() =>
    isExperimentAssignmentReady("search_home_featured_v1"),
  );
  const [flagWaitOver, setFlagWaitOver] = useState(false);
  useEffect(() => {
    if (flagsReady) return;
    const unsubscribe = onExperimentFlagsChange(() => {
      if (isExperimentAssignmentReady("search_home_featured_v1")) setFlagsReady(true);
    });
    const timer = setTimeout(() => setFlagWaitOver(true), FEATURED_FLAG_WAIT_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [flagsReady]);
  const { coordinate: featuredCoordinate, isApproximate: featuredLocationApproximate } =
    getEffectiveLocation({
      permission,
      currentLocation,
      manualCoordinate,
    });
  const [featuredDecision, setFeaturedDecision] = useState<{
    arm: string;
    /** False when the visit is outside the experiment: flags never loaded, or no real location. */
    inExperiment: boolean;
  } | null>(null);
  useEffect(() => {
    if (featuredDecision || (!flagsReady && !flagWaitOver)) return;
    // "near" from the built-in default point would list dishes near a place the diner is not
    // at, so without a GPS fix or a picked area the visit gets the island-wide list, unexposed.
    if (!flagsReady || featuredLocationApproximate) {
      setFeaturedDecision({ arm: "control", inExperiment: false });
      return;
    }
    setFeaturedDecision({
      arm: getExperimentVariant("search_home_featured_v1"),
      inExperiment: true,
    });
  }, [featuredDecision, featuredLocationApproximate, flagWaitOver, flagsReady]);
  const featuredArm = featuredDecision?.arm ?? "";
  const featuredLatitude = Math.round(featuredCoordinate.latitude * 1000) / 1000;
  const featuredLongitude = Math.round(featuredCoordinate.longitude * 1000) / 1000;
  useEffect(() => {
    if (!featuredArm) return;
    let active = true;
    const service = getCatalogRawService();
    const islandWide = () => service.listDishes({ limit: 3, sort: "quality" });
    const load =
      featuredArm === "near"
        ? service
            .listDishes({
              limit: 6,
              sort: "quality",
              coordinate: { latitude: featuredLatitude, longitude: featuredLongitude },
              radiusMeters: FEATURED_NEAR_RADIUS_METERS,
            })
            .then((page) => (page.items.length >= FEATURED_NEAR_MIN_ITEMS ? page : islandWide()))
        : islandWide();
    load
      .then((page) => {
        if (active) {
          setFeatured({
            arm: featuredArm,
            items: page.items,
            releaseId: page.releaseId || undefined,
            settled: true,
          });
        }
      })
      .catch((error) => {
        if (active) setFeatured({ arm: featuredArm, items: [], settled: true });
        reportLoadError("featured_dishes", error);
      });
    return () => {
      active = false;
    };
  }, [featuredArm, featuredLatitude, featuredLongitude, reportLoadError]);
  const featuredDishes = featured.arm === featuredArm ? featured.items : [];
  // Exposed only once the section is actually on screen: no typed text, loaded, not empty.
  const featuredEligible =
    Boolean(featuredDecision?.inExperiment) &&
    !trimmedSearchText &&
    featured.settled &&
    featured.arm === featuredArm &&
    featuredDishes.length > 0;
  const featuredVariant = useExperimentVariant("search_home_featured_v1", {
    enabled: featuredEligible,
  });

  useEffect(() => {
    if (!showSuggestions) return;
    let active = true;
    const timer = setTimeout(() => {
      getCatalogRawService()
        .suggest(trimmedSearchText)
        .then((items) => {
          if (active) setSuggestionResult({ query: trimmedSearchText, items });
        })
        .catch((error) => {
          reportLoadError("suggestions", error);
          // Nothing to suggest, so the loading rows stop.
          if (active) setSuggestionResult({ query: trimmedSearchText, items: [] });
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reportLoadError, showSuggestions, trimmedSearchText]);

  useEffect(() => {
    // A fade only: sliding the page in while the keyboard opens moves the field under the thumb.
    if (reduceMotion) {
      entryOpacity.setValue(1);
      return;
    }
    Animated.timing(entryOpacity, {
      toValue: 1,
      duration: motion.screenTransition,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [entryOpacity, motion.screenTransition, reduceMotion]);

  const openResults = (query: string, source: SearchHomeSource, browseMode?: BrowseMode) => {
    // The results grid saves a submitted query as a recent search, once it commits it.
    const trimmedQuery = query.trim();
    navigation.navigate("SearchResults", {
      browseMode,
      initialQuery: trimmedQuery || undefined,
      foodTypeTag: selectedCategory,
      source,
    });
  };

  const openSuggestion = (suggestion: CatalogSuggestion, surface: "typeahead" | "popular") => {
    trackAnalyticsEvent("search_suggestion_opened", { kind: suggestion.kind, surface });
    setSearchText(suggestion.label);
    if (suggestion.kind === "place" && suggestion.placeId) {
      // A place shows only the stalls inside that building, not every fuzzy name match. It is not
      // saved as a text recent: tapping that recent would run a name search, not the place.
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        placeId: suggestion.placeId,
        placeName: suggestion.label,
      });
      return;
    }
    if (suggestion.kind === "stall" && suggestion.venueId) {
      // A stall name that belongs to one stall opens that stall; a chain's name searches all outlets.
      navigation.navigate("StallDetail", { venueId: suggestion.venueId });
      return;
    }
    openResults(suggestion.label, "search_suggestion", suggestionMode(suggestion));
  };

  const openMatchedDish = (dish: CatalogRawDishCard, position: number) => {
    trackAnalyticsEvent("search_typeahead_opened", { kind: "dish", position });
    // The offline copy has only the read-only catalog page.
    if (matches.releaseId?.startsWith("excel-fallback")) {
      navigation.navigate("CatalogRawDetail", {
        kind: "dish",
        id: dish.id,
        releaseId: matches.releaseId,
      });
      return;
    }
    navigation.navigate("DishDetail", {
      dishId: dish.id,
      source: "search_typeahead",
      catalogFallback: { releaseId: matches.releaseId },
    });
  };

  const openMatchedStall = (stall: CatalogRawVenueCard, position: number) => {
    trackAnalyticsEvent("search_typeahead_opened", { kind: "stall", position });
    if (matches.releaseId?.startsWith("excel-fallback")) {
      navigation.navigate("CatalogRawDetail", {
        kind: "venue",
        id: stall.id,
        releaseId: matches.releaseId,
      });
      return;
    }
    navigation.navigate("StallDetail", { venueId: stall.id });
  };

  // Everything on this screen can come from the bundled copy of the catalog (SR4-31).
  const offlineCopy = [featured.releaseId, matches.releaseId].some((id) =>
    id?.startsWith("excel-fallback"),
  );

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
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
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
              placeholder="Try laksa or chicken rice"
              enableMovingPlaceholder
              movingPlaceholderPhrases={DISH_SEARCH_PLACEHOLDER_PHRASES}
              accessibilityLabel="Search dishes, stalls, or hawker centres"
              returnKeyType="search"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={() => openResults(searchText, "search_typed")}
            />
          </View>
        </View>
        {offlineCopy ? (
          <ResultsNotes
            notes={[
              {
                id: "offline",
                testID: "search-home-offline-copy",
                text: "You're seeing a saved copy of the catalog. It may be out of date.",
              },
            ]}
          />
        ) : null}
        {!trimmedSearchText ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {[
              {
                label: "Near me",
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
                icon: undefined,
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
        {showSuggestions ? (
          <View accessibilityLabel="Search suggestions" style={{ gap: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Search for ${trimmedSearchText}`}
              onPress={() => openResults(searchText, "search_typed")}
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing[3],
                minHeight: 44,
              }}
            >
              <SearchIcon color={palette.orange} size={18} />
              <AppText
                numberOfLines={1}
                style={{ color: palette.orange, flex: 1 }}
                variant="bodyBold"
              >
                {`Search “${trimmedSearchText}”`}
              </AppText>
              <ChevronRight color={palette.textMuted} size={18} />
            </Pressable>
            {suggestions.length > 0 ? (
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
                      accessibilityLabel={
                        suggestion.venueId
                          ? `Open ${suggestion.label}, ${SUGGESTION_KIND_LABELS[suggestion.kind]}${suggestion.subtitle ? ` at ${suggestion.subtitle}` : ""}`
                          : `Search ${suggestion.label}, ${SUGGESTION_KIND_LABELS[suggestion.kind]}`
                      }
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
                          {suggestion.subtitle
                            ? `${SUGGESTION_KIND_LABELS[suggestion.kind]} · ${suggestion.subtitle}`
                            : SUGGESTION_KIND_LABELS[suggestion.kind]}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : suggestionsLoading ? (
              <TypeaheadSkeleton label="Finding suggestions" rows={2} />
            ) : null}
            {matches.status === "loading" ? (
              <TypeaheadSkeleton label="Finding matches" rows={3} />
            ) : matches.status === "error" ? (
              <AppText accessibilityLiveRegion="polite" tone="secondary" variant="bodySmall">
                {"Couldn't load matches. Search above to try again."}
              </AppText>
            ) : matches.status === "ready" &&
              matches.dishes.length + matches.stalls.length === 0 ? (
              suggestions.length === 0 && !suggestionsLoading ? (
                <AppText accessibilityLiveRegion="polite" tone="secondary" variant="bodySmall">
                  {`No matches for “${trimmedSearchText}”. Check the spelling or try a shorter word.`}
                </AppText>
              ) : null
            ) : matches.status === "ready" ? (
              <View accessibilityLabel="Matching dishes and stalls" style={{ gap: spacing[2] }}>
                {matches.dishes.length > 0 ? (
                  <AppText accessibilityRole="header" variant="h3">
                    Dishes
                  </AppText>
                ) : null}
                {matches.dishes.map((dish, position) => (
                  <TypeaheadRow
                    key={`dish:${dish.id}`}
                    accessibilityLabel={`Open ${dish.name} from ${dish.venueName}`}
                    icon={<Utensils color={palette.textMuted} size={18} />}
                    onPress={() => openMatchedDish(dish, position)}
                    subtitle={`${dish.venueName}${dish.price != null ? ` · S$${dish.price.toFixed(2)}` : ""}`}
                    title={dish.name}
                  />
                ))}
                {matches.stalls.length > 0 ? (
                  <AppText accessibilityRole="header" variant="h3">
                    Stalls
                  </AppText>
                ) : null}
                {matches.stalls.map((stall, position) => (
                  <TypeaheadRow
                    key={`stall:${stall.id}`}
                    accessibilityLabel={
                      stall.buildingName
                        ? `Open ${stall.name} at ${stall.buildingName}`
                        : `Open ${stall.name}`
                    }
                    icon={<Store color={palette.textMuted} size={18} />}
                    onPress={() => openMatchedStall(stall, position)}
                    subtitle={stall.buildingName ?? "Singapore"}
                    title={stall.name}
                  />
                ))}
              </View>
            ) : null}
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
                Recent searches
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear recent searches"
                hitSlop={12}
                onPress={clearSearchHistory}
              >
                <AppText tone="secondary" variant="bodySmall">
                  Clear all
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
                      openResults(query, "search_recent");
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
                      width: 44,
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
                Hawker classics
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                Quick find
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
                hitSlop={12}
                onPress={() => openResults("", "search_featured")}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  minWidth: 44,
                }}
              >
                <ChevronRight color={palette.textMuted} size={20} />
              </Pressable>
            </View>
            {featuredDishes.map((dish, position) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${dish.name} from ${dish.venueName}`}
                onPress={() => {
                  trackAnalyticsEvent("search_home_featured_opened", {
                    position,
                    variant: featuredVariant,
                  });
                  // The dish page, with the catalog record as the fallback if it can't load.
                  // The offline copy has only the read-only catalog page.
                  if (featured.releaseId?.startsWith("excel-fallback")) {
                    navigation.navigate("CatalogRawDetail", {
                      kind: "dish",
                      id: dish.id,
                      releaseId: featured.releaseId,
                    });
                    return;
                  }
                  navigation.navigate("DishDetail", {
                    dishId: dish.id,
                    source: "search_featured",
                    catalogFallback: { releaseId: featured.releaseId },
                  });
                }}
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
                  <AppText variant="bodyBold" numberOfLines={2}>
                    {dish.name}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {dish.venueName}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.buildingName || "Singapore"}
                    {dish.distanceMeters != null
                      ? ` · ${formatBrowseDistance(dish.distanceMeters)}`
                      : ""}
                  </AppText>
                  {/* A rating with no reviews behind it is not a rating (no "★ 0.0"). */}
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.rating != null && (dish.reviewCount ?? 0) > 0 ? (
                      <>
                        <Text style={{ color: palette.starFill }}>★</Text>
                        {` ${dish.rating.toFixed(1)} (${dish.reviewCount})`}
                      </>
                    ) : null}
                    {dish.rating != null && (dish.reviewCount ?? 0) > 0 && dish.price != null
                      ? " · "
                      : ""}
                    {dish.price != null ? `S$${dish.price.toFixed(2)}` : ""}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

function TypeaheadSkeleton({ label, rows }: { label: string; rows: number }) {
  const { spacing } = useHungryTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: spacing[2] }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} width="100%" height={44} borderRadius={12} />
      ))}
    </View>
  );
}

function TypeaheadRow({
  accessibilityLabel,
  icon,
  onPress,
  subtitle,
  title,
}: {
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  const { spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{ alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 48 }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{title}</AppText>
        <AppText numberOfLines={1} tone="secondary" variant="micro">
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}
