import { memo, useCallback, useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { View } from "react-native";

import { AccessibleImage, AppSymbol, AppText, PressableScale } from "@/components/ui";
import {
  FOOD_STYLE_ITEM_WIDTH,
  getFoodStyleButtonMetrics,
} from "@/components/discover/home/homeLayout";
import type { PopularFoodStyle } from "@/features/discover/popularFoodStyles";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

export type PopularFoodStyleItemData = PopularFoodStyle & {
  dish: DishDetail | undefined;
  imageSource: ImageSourcePropType;
  imageUrl: string | undefined;
};

function FoodStyleButton({
  imageSource,
  label,
  onPressIn,
  onPress,
}: {
  imageSource: ImageSourcePropType;
  label: string;
  onPressIn?: () => void;
  onPress: () => void;
}) {
  const theme = useHungryTheme();
  const { palette, radii, shadows } = theme;
  // A bowl whose art fails to load shows a dish symbol, not an empty circle.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageSource]);
  const { bowlSize, buttonHeight, labelGap, labelLineHeight } = getFoodStyleButtonMetrics(theme);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Search for ${label}`}
      onPressIn={onPressIn}
      onPress={onPress}
      style={{ alignItems: "center", minHeight: buttonHeight, width: FOOD_STYLE_ITEM_WIDTH }}
    >
      <View
        style={[
          shadows.card,
          {
            width: bowlSize,
            height: bowlSize,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surfaceRaised,
            overflow: "hidden",
          },
        ]}
      >
        {imageFailed ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              flex: 1,
              justifyContent: "center",
            }}
          >
            <AppSymbol name="dish" size={28} color={palette.textMuted} />
          </View>
        ) : (
          <AccessibleImage
            source={imageSource}
            style={{ width: "100%", height: "100%", borderRadius: radii.pill }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            onError={() => setImageFailed(true)}
            decorative
          />
        )}
      </View>
      <AppText
        variant="bodySmallBold"
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.84}
        style={{
          color: palette.text,
          lineHeight: labelLineHeight,
          marginTop: labelGap,
          minHeight: labelLineHeight * 2,
          textAlign: "center",
        }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

const MemoFoodStyleButton = memo(FoodStyleButton);

export const PopularFoodStyleItem = memo(function PopularFoodStyleItem({
  item,
  onPress,
  onPrefetch,
}: {
  item: PopularFoodStyleItemData;
  onPress: (item: PopularFoodStyleItemData) => void;
  onPrefetch: (item: PopularFoodStyleItemData) => void;
}) {
  const handlePressIn = useCallback(() => {
    onPrefetch(item);
  }, [item, onPrefetch]);
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <MemoFoodStyleButton
      imageSource={item.imageSource}
      label={item.label}
      onPressIn={handlePressIn}
      onPress={handlePress}
    />
  );
});
