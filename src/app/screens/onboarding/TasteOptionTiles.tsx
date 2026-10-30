import { Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppSymbol, AppText } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";
import { usePressScale, useScaleIn } from "@/lib/motion/uiMotion";
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

/** The photo's side; the row is as tall as the photo plus its padding. */
const PHOTO_SIZE = 88;
/** Short phones (a 568 pt iPhone SE) get smaller photos so all three rows and Next fit. */
const COMPACT_PHOTO_SIZE = 60;
const COMPACT_SCREEN_HEIGHT = 700;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The check badge fades and scales in when its row is picked. */
function SelectedBadge() {
  const { palette, radii, spacing } = useHungryTheme();
  const style = useScaleIn(useReduceMotion());
  return (
    <Animated.View
      style={[
        {
          alignItems: "center",
          backgroundColor: palette.orange,
          borderRadius: radii.pill,
          height: 24,
          justifyContent: "center",
          marginRight: spacing[1],
          width: 24,
        },
        style,
      ]}
    >
      <AppSymbol name="selected" color={palette.surface} size={14} weight="bold" />
    </Animated.View>
  );
}

interface TasteTileProps {
  index: number;
  question: string;
  label: string;
  food: OnboardingFoodImage;
  isSelected: boolean;
  dimmed: boolean;
  disabled: boolean;
  photoSize: number;
  onSelect: (index: number) => void;
}

function TasteTile({
  index,
  question,
  label,
  food,
  isSelected,
  dimmed,
  disabled,
  photoSize,
  onSelect,
}: TasteTileProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const press = usePressScale(useReduceMotion());
  return (
    <AnimatedPressable
      testID={`taste-tile-${index}`}
      onPress={() => {
        // The selection tick lands on the same frame as the check.
        selectHaptic();
        onSelect(index);
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${question} ${label}`}
      accessibilityHint={`For example, ${food.label}`}
      accessibilityState={{ checked: isSelected, disabled }}
      aria-checked={isSelected}
      style={[
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: isSelected ? palette.orange : palette.border,
          borderRadius: radii.lg,
          borderWidth: isSelected ? 3 : 1,
          flexDirection: "row",
          gap: spacing[3],
          opacity: dimmed ? 0.6 : 1,
          padding: spacing[2],
        },
        press.animatedStyle,
      ]}
    >
      <View
        style={{
          borderRadius: radii.md,
          height: photoSize,
          overflow: "hidden",
          width: photoSize,
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
      </View>
      <View style={{ flex: 1, gap: spacing[1] }}>
        <AppText variant="h3" tone={isSelected ? "default" : "secondary"}>
          {label}
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          {food.label}
        </AppText>
      </View>
      {isSelected ? <SelectedBadge /> : null}
    </AnimatedPressable>
  );
}

/**
 * The three answers of a taste question as full-width rows (photo on the left, the answer and
 * an example dish on the right), so nobody has to swipe and no label is cut short. A tap
 * answers; nothing else does. The picked row has an orange ring and a check badge and the
 * others fade, so the choice never rests on a bolder label alone.
 */
export function TasteOptionTiles({
  question,
  labels,
  foods,
  selectedIndex,
  disabled = false,
  onSelect,
}: TasteOptionTilesProps) {
  const { spacing } = useHungryTheme();
  const { height } = useWindowDimensions();
  const photoSize = height < COMPACT_SCREEN_HEIGHT ? COMPACT_PHOTO_SIZE : PHOTO_SIZE;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
      style={{ gap: spacing[2], paddingHorizontal: spacing[3] }}
    >
      {labels.map((label, index) => (
        <TasteTile
          key={label}
          index={index}
          question={question}
          label={label}
          food={foods[index]!}
          isSelected={selectedIndex === index}
          dimmed={selectedIndex >= 0 && selectedIndex !== index}
          disabled={disabled}
          photoSize={photoSize}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
