import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { OnboardingFoodImage } from "./onboardingFoodImages";

interface TasteOptionTilesProps {
  question: string;
  labels: readonly string[];
  foods: readonly OnboardingFoodImage[];
  /** The card the user picked, or -1 when this question is not answered yet. */
  selectedIndex: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
}

/**
 * The three answers of a taste question side by side, so nobody has to swipe to see the
 * options. A tap answers; nothing else does. The picked tile has an orange ring and a check
 * badge and the others fade, so the choice never rests on a bolder label alone.
 */
export function TasteOptionTiles({
  question,
  labels,
  foods,
  selectedIndex,
  disabled = false,
  onSelect,
}: TasteOptionTilesProps) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
      style={{ flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[3] }}
    >
      {labels.map((label, index) => {
        const isSelected = selectedIndex === index;
        const food = foods[index]!;
        return (
          <Pressable
            key={label}
            testID={`taste-tile-${index}`}
            onPress={() => onSelect(index)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`${question} ${label}`}
            accessibilityHint={`For example, ${food.label}`}
            accessibilityState={{ checked: isSelected, disabled }}
            aria-checked={isSelected}
            style={{
              alignItems: "center",
              flex: 1,
              gap: spacing[2],
              opacity: selectedIndex >= 0 && !isSelected ? 0.6 : 1,
            }}
          >
            <View
              style={{
                aspectRatio: 0.78,
                borderColor: isSelected ? palette.orange : "transparent",
                borderRadius: radii.lg,
                borderWidth: 3,
                overflow: "hidden",
                width: "100%",
              }}
            >
              {food.imageSource ? (
                <AccessibleImage
                  source={food.imageSource}
                  contentFit="cover"
                  contentPosition="center"
                  style={{ height: "100%", width: "100%" }}
                  decorative
                />
              ) : (
                <NoDishPhoto dishName={food.label} style={{ height: "100%", width: "100%" }} />
              )}
              {isSelected ? (
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.orange,
                    borderRadius: radii.pill,
                    height: 24,
                    justifyContent: "center",
                    position: "absolute",
                    right: spacing[1],
                    top: spacing[1],
                    width: 24,
                  }}
                >
                  <Check color={palette.surface} size={14} />
                </View>
              ) : null}
            </View>
            <AppText
              variant="bodyBold"
              tone={isSelected ? "default" : "secondary"}
              numberOfLines={1}
              style={{ textAlign: "center", width: "100%" }}
            >
              {label}
            </AppText>
            <AppText
              variant="micro"
              tone="secondary"
              numberOfLines={1}
              style={{ textAlign: "center", width: "100%" }}
            >
              {food.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
