import { useMemo, useState, useRef, useEffect } from "react";
import { Pressable, View, Animated, ScrollView, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import {
  ONBOARDING_CUISINE_FOOD_CHOICES,
  ONBOARDING_CUISINES,
  type OnboardingFoodChoice,
} from "./onboardingFoodImages";

type Props = NativeStackScreenProps<OnboardingStackParamList, "CuisineSelection">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const CARD_H = CARD_W * 1.3;
const DISH_TILE = 104;

function DishTile({
  dish,
  isSelected,
  onPress,
}: {
  dish: OnboardingFoodChoice;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { palette } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${dish.label}`}
      style={{ width: DISH_TILE, gap: 6 }}
    >
      <View
        style={{
          width: DISH_TILE,
          height: DISH_TILE,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: isSelected ? 2.5 : 1.5,
          borderColor: isSelected ? palette.orange : palette.border,
        }}
      >
        <AccessibleImage
          source={dish.imageSource}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          decorative
        />
        {isSelected ? (
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: palette.orange,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={2} style={{ color: palette.text, fontSize: 13, lineHeight: 17 }}>
        {dish.label}
      </AppText>
    </Pressable>
  );
}

function CuisineCard({
  cuisine,
  isSelected,
  onPress,
  enterAnim,
}: {
  cuisine: (typeof ONBOARDING_CUISINES)[0];
  isSelected: boolean;
  onPress: () => void;
  enterAnim: Animated.Value;
}) {
  const { palette } = useHungryTheme();
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.95, duration: 70, useNativeDriver: true }),
      Animated.spring(pressAnim, { toValue: 1, damping: 14, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [
          { scale: pressAnim },
          {
            translateY: enterAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${cuisine.label}`}
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: isSelected ? 2.5 : 1.5,
          borderColor: isSelected ? palette.orange : palette.border,
          backgroundColor: palette.surfaceRaised,
        }}
      >
        <AccessibleImage
          source={cuisine.imageSource}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          decorative
        />
        {/* Dark scrim at bottom, fading out upward */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60%",
          }}
        />
        {/* Orange tint when selected */}
        {isSelected && (
          <View
            style={{
              position: "absolute",
              inset: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: `${palette.orange}28`,
            }}
          />
        )}
        {/* Label */}
        <AppText
          numberOfLines={2}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 40,
            color: "#FFFFFF",
            fontFamily: "Nunito_700Bold",
            fontSize: 14,
            lineHeight: 19,
          }}
        >
          {cuisine.label}
        </AppText>
        {/* Check badge */}
        <View
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: isSelected ? palette.orange : "rgba(255,255,255,0.22)",
            borderWidth: isSelected ? 0 : 1.5,
            borderColor: "rgba(255,255,255,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function CuisineSelectionScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const setOnboardingSelectedDishIds = useProfileStore((s) => s.setOnboardingSelectedDishIds);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);

  // Optional dish picks for the cuisines chosen above (one screen, no per-cuisine steps).
  const dishSections = useMemo(
    () =>
      selected
        .map((cuisineId) => ({
          cuisine: ONBOARDING_CUISINES.find((c) => c.id === cuisineId),
          dishes: ONBOARDING_CUISINE_FOOD_CHOICES[cuisineId] ?? [],
        }))
        .filter((section) => section.cuisine && section.dishes.length > 0),
    [selected],
  );

  const cardAnims = useRef(ONBOARDING_CUISINES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      45,
      cardAnims.map((anim) =>
        Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }),
      ),
    ).start();
  }, [cardAnims]);

  const toggle = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleDish = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDishIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Only keep picks that still belong to a selected cuisine.
    const visibleDishIds = new Set(
      dishSections.flatMap((section) => section.dishes.map((dish) => dish.id)),
    );
    setOnboardingSelectedDishIds(selectedDishIds.filter((id) => visibleDishIds.has(id)));
    navigation.navigate("TasteQuiz");
  };

  // Pair into rows of 2
  const rows: (typeof ONBOARDING_CUISINES)[] = [];
  for (let i = 0; i < ONBOARDING_CUISINES.length; i += 2) {
    rows.push(ONBOARDING_CUISINES.slice(i, i + 2));
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: H_PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 28 }}>
          <AppText
            style={{
              fontFamily: "Fraunces_700Bold",
              fontSize: 38,
              lineHeight: 44,
              color: palette.text,
              marginBottom: 8,
            }}
          >
            {"What do you\nlove?"}
          </AppText>
          <AppText style={{ color: palette.textSecondary, fontSize: 15, lineHeight: 22 }}>
            Pick your go-to cuisines, then any dishes you love.
          </AppText>
        </View>

        {/* Grid */}
        <View style={{ gap: GAP }}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: "row", gap: GAP }}>
              {row.map((cuisine, colIdx) => {
                const idx = rowIdx * 2 + colIdx;
                return (
                  <CuisineCard
                    key={cuisine.id}
                    cuisine={cuisine}
                    isSelected={selected.includes(cuisine.id)}
                    onPress={() => toggle(cuisine.id)}
                    enterAnim={cardAnims[idx]}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {dishSections.length > 0 ? (
          <View style={{ marginTop: 28, gap: 20 }}>
            <View>
              <AppText
                style={{
                  fontFamily: "Fraunces_700Bold",
                  fontSize: 24,
                  lineHeight: 30,
                  color: palette.text,
                }}
              >
                Any favourites?
              </AppText>
              <AppText style={{ color: palette.textSecondary, fontSize: 14, lineHeight: 20 }}>
                Optional. Tap the dishes you would order again.
              </AppText>
            </View>
            {dishSections.map(({ cuisine, dishes }) => (
              <View key={cuisine!.id} style={{ gap: 10 }}>
                <AppText
                  style={{ color: palette.text, fontFamily: "Nunito_700Bold", fontSize: 15 }}
                >
                  {cuisine!.label}
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: GAP }}
                >
                  {dishes.map((dish) => (
                    <DishTile
                      key={dish.id}
                      dish={dish}
                      isSelected={selectedDishIds.includes(dish.id)}
                      onPress={() => toggleDish(dish.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed bottom bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: H_PAD,
          paddingTop: 14,
          paddingBottom: insets.bottom + 16,
          backgroundColor: palette.bg,
          borderTopWidth: 1,
          borderTopColor: palette.border,
        }}
      >
        {selected.length > 0 && (
          <AppText
            style={{
              color: palette.orange,
              fontFamily: "Nunito_600SemiBold",
              fontSize: 13,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {selected.length} cuisine{selected.length !== 1 ? "s" : ""} selected
          </AppText>
        )}
        <Button
          label="Next"
          onPress={handleNext}
          disabled={selected.length === 0}
          variant="primary"
        />
      </View>
    </View>
  );
}
