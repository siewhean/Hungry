import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  PopularFoodStyleItem,
  type PopularFoodStyleItemData,
} from "@/components/discover/home/PopularFoodStyleItem";
import { FOOD_STYLE_ITEM_WIDTH } from "@/components/discover/home/homeLayout";
import { AppText, PressableScale, Screen } from "@/components/ui";
import { putFavouritesFirst } from "@/features/discover/favouriteOrder";
import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { confirmHaptic } from "@/lib/haptics";
import { useFeedFeedbackStore } from "@/store/useFeedFeedbackStore";
import { useHungryTheme } from "@/theme";

/**
 * Every popular dish as a picture circle, so one can be picked without scrolling Home's row.
 * Pinned dishes (a star on the circle) come first here and on Home. Hold a circle to pin it, or
 * tap Edit and tap the dishes to pin.
 */
export function FoodStylesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette, semanticSpacing, spacing } = useHungryTheme();
  const favouriteIds = useFeedFeedbackStore((state) => state.favouriteFoodStyleIds);
  const toggleFavourite = useFeedFeedbackStore((state) => state.toggleFavouriteFoodStyle);
  const [isEditing, setIsEditing] = useState(false);
  const { width } = useWindowDimensions();
  // Same pictures as the Home row (laksa and the others), so a dish looks the same everywhere.
  const items = useMemo<PopularFoodStyleItemData[]>(
    () =>
      POPULAR_FOOD_STYLES.flatMap((style) =>
        style.imageSource !== undefined
          ? [{ ...style, dish: undefined, imageSource: style.imageSource, imageUrl: undefined }]
          : [],
      ),
    [],
  );
  const columns = Math.max(
    2,
    Math.floor((width - semanticSpacing.screenEdge * 2) / (FOOD_STYLE_ITEM_WIDTH + spacing[2])),
  );
  const orderedItems = useMemo(
    () => putFavouritesFirst(items, favouriteIds),
    [items, favouriteIds],
  );
  const handleToggleFavourite = useCallback(
    (item: PopularFoodStyleItemData) => {
      toggleFavourite(item.id);
      trackAnalyticsEvent(
        favouriteIds.includes(item.id)
          ? "home_food_style_unfavourited"
          : "home_food_style_favourited",
        { surface: "popular_dishes", food_style: item.id },
      );
    },
    [favouriteIds, toggleFavourite],
  );
  const handlePress = useCallback(
    (item: PopularFoodStyleItemData) => {
      // While editing, a tap pins or unpins the dish instead of searching for it.
      if (isEditing) {
        confirmHaptic();
        handleToggleFavourite(item);
        return;
      }
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        initialQuery: item.query,
        source: "discover_chip",
      });
    },
    [handleToggleFavourite, isEditing, navigation],
  );
  const noPrefetch = useCallback(() => undefined, []);

  return (
    <Screen
      title="Popular dishes"
      headerRight={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Done editing favourites" : "Edit favourites"}
          hitSlop={8}
          onPress={() => setIsEditing((editing) => !editing)}
          style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[2] }}
        >
          <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
            {isEditing ? "Done" : "Edit favourites"}
          </AppText>
        </PressableScale>
      }
    >
      {isEditing ? (
        <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
          Tap the dishes you want first on Home.
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing[4] }}>
        {orderedItems.map((item) => (
          <View key={item.id} style={{ alignItems: "center", width: `${100 / columns}%` }}>
            <PopularFoodStyleItem
              item={item}
              isFavourite={favouriteIds.includes(item.id)}
              onPress={handlePress}
              onPrefetch={noPrefetch}
              onToggleFavourite={handleToggleFavourite}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}
