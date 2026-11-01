import { useCallback, useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  PopularFoodStyleItem,
  type PopularFoodStyleItemData,
} from "@/components/discover/home/PopularFoodStyleItem";
import { FOOD_STYLE_ITEM_WIDTH } from "@/components/discover/home/homeLayout";
import { Screen } from "@/components/ui";
import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import { useHungryTheme } from "@/theme";

/** Every popular dish as a picture circle, so one can be picked without scrolling Home's row. */
export function FoodStylesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { semanticSpacing, spacing } = useHungryTheme();
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
  const handlePress = useCallback(
    (item: PopularFoodStyleItemData) =>
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        initialQuery: item.query,
        source: "discover_chip",
      }),
    [navigation],
  );
  const noPrefetch = useCallback(() => undefined, []);

  return (
    <Screen title="Popular dishes" subtitle="Pick a dish to see who serves it">
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing[4] }}>
        {items.map((item) => (
          <View key={item.id} style={{ alignItems: "center", width: `${100 / columns}%` }}>
            <PopularFoodStyleItem item={item} onPress={handlePress} onPrefetch={noPrefetch} />
          </View>
        ))}
      </View>
    </Screen>
  );
}
