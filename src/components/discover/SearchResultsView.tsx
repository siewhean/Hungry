import { memo, useCallback, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { ArrowLeft, Search, X, SlidersHorizontal, Star } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";

import { AccessibleImage, AppText, EmptyState, Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type FilterTab = "All" | "Dishes";

interface SearchResultsViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onBack?: () => void;
  onSubmitQuery?: (query: string) => void;
  onTasteFilterPress: () => void;
  results: DishDetail[];
  /** Short line above the results, e.g. what a plain-language search was understood as. */
  resultsNote?: string;
  isLoading?: boolean;
  onResultPressIn?: (dish: DishDetail) => void;
  onResultPress: (dish: DishDetail) => void;
}

function SearchResultsSkeletonList() {
  const { radii, spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[4], padding: spacing[4] }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View
          key={`search-result-skeleton-${index}`}
          style={{ flexDirection: "row", gap: spacing[3] }}
        >
          <Skeleton width={80} height={80} borderRadius={radii.md} />
          <View style={{ flex: 1, gap: spacing[2], justifyContent: "center" }}>
            <Skeleton width="72%" height={18} borderRadius={radii.sm} />
            <Skeleton width="42%" height={14} borderRadius={radii.sm} />
            <Skeleton width={56} height={18} borderRadius={radii.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

interface SearchResultRowProps {
  dish: DishDetail;
  onPressIn?: (dish: DishDetail) => void;
  onPress: (dish: DishDetail) => void;
}

const SearchResultRow = memo(function SearchResultRow({
  dish,
  onPress,
  onPressIn,
}: SearchResultRowProps) {
  const { palette, radii, spacing } = useHungryTheme();

  const handlePressIn = useCallback(() => {
    onPressIn?.(dish);
  }, [dish, onPressIn]);

  const handlePress = useCallback(() => {
    onPress(dish);
  }, [dish, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${dish.name}`}
      onPressIn={handlePressIn}
      onPress={handlePress}
      style={{ flexDirection: "row", gap: spacing[3] }}
    >
      <AccessibleImage
        source={{ uri: dish.imageUrl }}
        accessibilityLabel={`${dish.name} from ${dish.venueName}`}
        style={{ width: 80, height: 80, borderRadius: radii.md }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
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
  );
});

export function SearchResultsView({
  query,
  onQueryChange,
  onClear,
  onBack,
  onSubmitQuery,
  onTasteFilterPress,
  results,
  resultsNote,
  isLoading = false,
  onResultPressIn,
  onResultPress,
}: SearchResultsViewProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const searchInputRef = useRef<TextInput | null>(null);
  const handleClear = useCallback(() => {
    onClear();
    // Keep focus in the field so the user can type the next query straight away.
    searchInputRef.current?.focus();
  }, [onClear]);
  const TABS: FilterTab[] = ["All", "Dishes"];
  const renderResult = useCallback(
    ({ item: dish }: { item: DishDetail }) => (
      <SearchResultRow dish={dish} onPressIn={onResultPressIn} onPress={onResultPress} />
    ),
    [onResultPress, onResultPressIn],
  );
  const emptyTitle = query.trim() ? "No matches found" : "No dishes yet";
  const emptyBody = query.trim()
    ? "Try another dish or taste filter."
    : "Search for a dish, stall, or craving.";

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Always-visible header: back + search field + clear. The previous
          collapsed reveal-on-tap search rendered as an empty band (QA #17). */}
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        }}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack}
            style={{ alignItems: "center", height: 44, justifyContent: "center", width: 32 }}
          >
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
        ) : null}
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: spacing[2],
            height: 48,
            paddingHorizontal: spacing[3],
          }}
        >
          <Search color={palette.orange} size={20} />
          <TextInput
            ref={searchInputRef}
            accessibilityLabel="Search dishes"
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={() => onSubmitQuery?.(query)}
            placeholder="Search dishes, stalls, or your cravings"
            placeholderTextColor={palette.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            style={{
              color: palette.text,
              flex: 1,
              fontFamily: "Nunito_400Regular",
              fontSize: 16,
              height: 48,
              padding: 0,
              textAlignVertical: "center",
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={12}
            >
              <X color={palette.textMuted} size={20} />
            </Pressable>
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

      {isLoading ? (
        <SearchResultsSkeletonList />
      ) : (
        <FlashList
          data={results}
          // Taps on rows/clear work on the first tap while the keyboard is up.
          keyboardShouldPersistTaps="handled"
          keyExtractor={(dish) => dish.id}
          renderItem={renderResult}
          ItemSeparatorComponent={() => <View style={{ height: spacing[4] }} />}
          ListHeaderComponent={
            resultsNote ? (
              <AppText variant="micro" tone="secondary" style={{ marginBottom: spacing[3] }}>
                {resultsNote}
              </AppText>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Search size={34} color={palette.orange} />}
              title={emptyTitle}
              body={emptyBody}
            />
          }
          // @ts-ignore FlashList v2 runtime supports this prop but its bundled RN type omits it.
          estimatedItemSize={96}
          contentContainerStyle={{ padding: spacing[4] }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
