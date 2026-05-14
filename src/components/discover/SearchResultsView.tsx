import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Search, X, SlidersHorizontal, Star } from "lucide-react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type FilterTab = "All" | "Dishes";

interface SearchResultsViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onSubmitQuery?: (query: string) => void;
  onTasteFilterPress: () => void;
  results: DishDetail[];
  onResultPressIn?: (dish: DishDetail) => void;
  onResultPress: (dish: DishDetail) => void;
}

export function SearchResultsView({
  query,
  onQueryChange,
  onClear,
  onSubmitQuery,
  onTasteFilterPress,
  results,
  onResultPressIn,
  onResultPress,
}: SearchResultsViewProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2, 240),
    [screenWidth, spacing],
  );
  const searchIconSize = 56;
  const searchEntryWidth = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchBarWidth],
    extrapolate: "clamp",
  });
  const searchInputOpacity = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const searchInputScale = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
    extrapolate: "clamp",
  });
  const TABS: FilterTab[] = ["All", "Dishes"];
  const renderResult = useCallback(
    ({ item: dish }: { item: DishDetail }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${dish.name}`}
        onPressIn={() => onResultPressIn?.(dish)}
        onPress={() => onResultPress(dish)}
        style={{ flexDirection: "row", gap: spacing[3] }}
      >
        <Image
          source={{ uri: dish.imageUrl }}
          style={{ width: 80, height: 80, borderRadius: radii.md }}
          contentFit="cover"
        />
        <View style={{ flex: 1, justifyContent: "center", gap: spacing[1] }}>
          <AppText variant="bodyBold" numberOfLines={1}>
            {dish.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
            <Star color={palette.amber} fill={palette.amber} size={14} />
            <AppText variant="micro" style={{ fontWeight: "700" }}>
              {dish.rating.toFixed(1)}
            </AppText>
            <AppText variant="micro" tone="secondary">
              ({dish.reviewCount})
            </AppText>
          </View>
          <AppText style={{ color: palette.orange, fontWeight: "800" }}>
            S${dish.price.toFixed(2)}
          </AppText>
        </View>
      </Pressable>
    ),
    [onResultPress, onResultPressIn, palette.amber, palette.orange, radii.md, spacing],
  );

  const revealSearch = useCallback(() => {
    if (isSearchExpanded) return;
    setIsSearchExpanded(true);
    searchRevealProgress.stopAnimation();
    searchRevealProgress.setValue(0);
    Animated.timing(searchRevealProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  }, [isSearchExpanded, searchRevealProgress]);

  const hideSearch = useCallback(() => {
    if (!isSearchExpanded) {
      return;
    }

    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
      }),
    );
  }, [isSearchExpanded, searchRevealProgress]);

  useEffect(() => {
    return () => {
      searchRevealProgress.stopAnimation();
      searchRevealProgress.setValue(0);
    };
  }, [searchRevealProgress]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, position: "relative" }}>
      {isSearchExpanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss search"
          onPress={hideSearch}
          style={searchResultsStyles.searchDismissOverlay}
        />
      ) : null}
      <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}>
        <View
          style={{
            alignItems: "center",
            position: "relative",
            width: isSearchExpanded ? searchBarWidth : searchIconSize,
            zIndex: 30,
          }}
        >
          <View
            style={{
              width: searchBarWidth,
              height: 56,
              alignItems: "center",
              justifyContent: "flex-start",
              flexDirection: "row",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              onPress={isSearchExpanded ? hideSearch : revealSearch}
              style={{
                width: searchIconSize,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Search color={palette.orange} size={20} />
            </Pressable>
          </View>

          {isSearchExpanded ? (
            <Animated.View
              pointerEvents="auto"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: 56,
                borderRadius: radii.pill,
                overflow: "hidden",
                width: searchEntryWidth,
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.orange,
                ...shadows.card,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                paddingHorizontal: spacing[3],
              }}
            >
              <Animated.View
                style={{
                  flex: 1,
                  opacity: searchInputOpacity,
                  transform: [{ scale: searchInputScale }],
                }}
              >
                <TextInput
                  ref={searchInputRef}
                  value={query}
                  onChangeText={onQueryChange}
                  onSubmitEditing={() => onSubmitQuery?.(query)}
                  onBlur={hideSearch}
                  placeholder="Search..."
                  placeholderTextColor={palette.textMuted}
                  returnKeyType="search"
                  style={{
                    color: palette.text,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 16,
                    height: 56,
                    padding: 0,
                    textAlignVertical: "center",
                  }}
                />
              </Animated.View>
              <Animated.View style={{ opacity: searchInputOpacity }}>
                {query.length > 0 ? (
                  <Pressable
                    onPress={onClear}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <X color={palette.textMuted} size={20} />
                  </Pressable>
                ) : null}
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                marginRight: spacing[6],
                paddingVertical: spacing[3],
                borderBottomWidth: 2,
                borderBottomColor: isActive ? palette.orange : "transparent",
              }}
            >
              <AppText
                variant="bodySmall"
                style={{
                  fontWeight: isActive ? "800" : "600",
                  color: isActive ? palette.text : palette.textSecondary,
                }}
              >
                {tab}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
        <Pressable
          onPress={onTasteFilterPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            alignSelf: "flex-start",
            paddingVertical: spacing[1],
            paddingHorizontal: spacing[3],
            borderRadius: radii.pill,
            backgroundColor: palette.bgSoft,
          }}
        >
          <SlidersHorizontal color={palette.navy} size={16} />
          <AppText variant="micro" style={{ fontWeight: "700" }}>
            TASTE FILTERS
          </AppText>
        </Pressable>
      </View>

      <FlashList
        data={results}
        keyExtractor={(dish) => dish.id}
        renderItem={renderResult}
        ItemSeparatorComponent={() => <View style={{ height: spacing[4] }} />}
        // @ts-ignore FlashList v2 runtime supports this prop but its bundled RN type omits it.
        estimatedItemSize={96}
        contentContainerStyle={{ padding: spacing[4] }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const searchResultsStyles = StyleSheet.create({
  searchDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 20,
  },
});
