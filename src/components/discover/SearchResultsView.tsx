import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { ArrowLeft, MapPinned, Search, SlidersHorizontal, Star, X } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";

import { AccessibleImage, AppText, EmptyState, Skeleton } from "@/components/ui";
import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import {
  formatDiscoverDistance,
  formatDiscoverPrice,
  getDishFallbackImageSource,
  getEffectiveCuisineTags,
} from "@/features/discover/presentation";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

interface SearchResultsViewProps {
  query: string;
  onBack: () => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onSubmitQuery?: (query: string) => void;
  onTasteFilterPress: () => void;
  results: DishDetail[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
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
  const cuisineTags = getEffectiveCuisineTags(dish);
  const distanceLabel = formatDiscoverDistance(dish.distanceMeters);
  const priceLabel = formatDiscoverPrice(dish);
  const hasUsableImage = isUsableDiscoverImageUrl(dish.imageUrl);
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const showRemoteImage = hasUsableImage && !remoteImageFailed;

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [dish.id, dish.imageUrl]);

  const handlePressIn = useCallback(() => {
    onPressIn?.(dish);
  }, [dish, onPressIn]);

  const handlePress = useCallback(() => {
    onPress(dish);
  }, [dish, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${dish.name} at ${dish.venueName}, ${[
        ...cuisineTags,
        priceLabel,
        distanceLabel ? `${distanceLabel} away` : "distance unavailable",
      ].join(", ")}`}
      onPressIn={handlePressIn}
      onPress={handlePress}
      style={{ flexDirection: "row", gap: spacing[3] }}
    >
      <View style={{ width: 88, height: 88, borderRadius: radii.md, overflow: "hidden" }}>
        <AccessibleImage
          source={
            showRemoteImage
              ? { uri: dish.imageUrl }
              : getDishFallbackImageSource({
                  cuisineTags: dish.cuisineTags,
                  foodTypeTag: dish.foodTypeTag,
                  name: dish.name,
                  venueName: dish.venueName,
                })
          }
          accessibilityLabel={`${dish.name} from ${dish.venueName}${
            showRemoteImage ? "" : " representative image"
          }`}
          onError={showRemoteImage ? () => setRemoteImageFailed(true) : undefined}
          style={{ width: 88, height: 88 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
        {!showRemoteImage ? (
          <View
            style={{
              backgroundColor: palette.imageLabelSurface,
              bottom: spacing[1],
              left: spacing[1],
              paddingHorizontal: spacing[1],
              paddingVertical: spacing[0.5],
              position: "absolute",
            }}
          >
            <AppText
              variant="micro"
              style={{ color: palette.textOnDark, fontSize: 8, fontWeight: "900" }}
            >
              REPRESENTATIVE
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing[1] }}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {dish.name}
        </AppText>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
          <AppText variant="micro" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {dish.venueName}
          </AppText>
          {cuisineTags[0] ? (
            <View
              style={{
                backgroundColor: palette.orangeLight,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[1.5],
                paddingVertical: spacing[0.5],
              }}
            >
              <AppText variant="micro" style={{ color: palette.orangeText, fontWeight: "800" }}>
                {cuisineTags[0]}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
          <Star color={palette.amber} fill={palette.amber} size={14} />
          <AppText variant="micro" style={{ fontWeight: "700" }}>
            {dish.rating.toFixed(1)}
          </AppText>
          <AppText variant="micro" tone="secondary">
            ({dish.reviewCount})
          </AppText>
          {distanceLabel ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
              <MapPinned color={palette.textMuted} size={12} />
              <AppText variant="micro" tone="secondary">
                {distanceLabel}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText style={{ color: palette.orange, fontWeight: "800" }}>{priceLabel}</AppText>
      </View>
    </Pressable>
  );
});

export function SearchResultsView({
  query,
  onBack,
  onQueryChange,
  onClear,
  onSubmitQuery,
  onTasteFilterPress,
  results,
  isLoading = false,
  errorMessage,
  onRetry,
  onResultPressIn,
  onResultPress,
}: SearchResultsViewProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
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
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        }}
      >
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={{ alignItems: "center", height: 56, justifyContent: "center", width: 40 }}
        >
          <ArrowLeft color={palette.text} size={24} />
        </Pressable>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.orange,
            borderRadius: radii.pill,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: spacing[2],
            height: 56,
            paddingHorizontal: spacing[3],
            ...shadows.card,
          }}
        >
          <Search color={palette.orange} size={20} />
          <TextInput
            accessibilityLabel="Search results"
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={() => onSubmitQuery?.(query)}
            placeholder="Search dishes, stalls, or your cravings"
            placeholderTextColor={palette.textMuted}
            returnKeyType="search"
            style={{
              color: palette.text,
              flex: 1,
              fontFamily: "Nunito_400Regular",
              fontSize: 16,
              height: 56,
              padding: 0,
              textAlignVertical: "center",
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <X color={palette.textMuted} size={20} />
            </Pressable>
          ) : null}
        </View>
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
          keyExtractor={(dish) => dish.id}
          renderItem={renderResult}
          ItemSeparatorComponent={() => <View style={{ height: spacing[4] }} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Search size={34} color={palette.orange} />}
              title={errorMessage ? "Unable to search right now" : emptyTitle}
              body={errorMessage ? "Check your connection and try again." : emptyBody}
              ctaLabel={errorMessage ? "Retry" : undefined}
              onPress={errorMessage ? onRetry : undefined}
              errorMessage={errorMessage ?? undefined}
              sendErrorContext={errorMessage ? "Dish search results" : undefined}
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
