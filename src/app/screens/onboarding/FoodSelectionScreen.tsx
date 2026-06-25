import { useMemo, useState, useEffect, useRef } from "react";
import { Pressable, View, Animated, ScrollView, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ONBOARDING_CUISINE_FOOD_CHOICES, ONBOARDING_CUISINE_LABELS } from "./onboardingFoodImages";

type Props = NativeStackScreenProps<OnboardingStackParamList, "FoodSelection">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const CARD_H = CARD_W * 1.15;

function DishCard({
  dish,
  isSelected,
  onPress,
  enterAnim,
}: {
  dish: { id: string; label: string; imageSource: unknown; venueName: string };
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
        accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${dish.label}, ${dish.venueName}`}
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: isSelected ? 2.5 : 1.5,
          borderColor: isSelected ? palette.orange : palette.border,
        }}
      >
        <AccessibleImage
          source={dish.imageSource as never}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          decorative
        />
        {/* Dark scrim */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60%",
            backgroundColor: "rgba(0,0,0,0.58)",
          }}
        />
        {/* Orange tint when selected */}
        {isSelected && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: `${palette.orange}28`,
            }}
          />
        )}
        {/* Dish name + venue */}
        <View style={{ position: "absolute", bottom: 10, left: 10, right: 36 }}>
          <AppText
            numberOfLines={1}
            style={{
              color: palette.textOnDark,
              fontFamily: "Nunito_700Bold",
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {dish.label}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{
              color: "rgba(255,255,255,0.72)",
              fontFamily: "Nunito_400Regular",
              fontSize: 11,
              lineHeight: 15,
              marginTop: 1,
            }}
          >
            {dish.venueName}
          </AppText>
        </View>
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
          {isSelected && <Check size={13} color={palette.textOnDark} strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function FoodSelectionScreen({ navigation, route }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const setOnboardingSelectedDishIds = useProfileStore((s) => s.setOnboardingSelectedDishIds);
  const selectedCuisines = route.params.cuisines;

  const [currentIndex, setCurrentCuisineIndex] = useState(0);
  const [accumulatedSelectedIds, setAccumulatedSelectedIds] = useState<string[]>([]);
  const [currentCuisineSelectedIds, setCurrentCuisineSelectedIds] = useState<string[]>([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef<Animated.Value[]>([]);

  const currentCuisineId = selectedCuisines[currentIndex] ?? "local";
  const currentCuisineLabel =
    ONBOARDING_CUISINE_LABELS[currentCuisineId] ||
    currentCuisineId.charAt(0).toUpperCase() + currentCuisineId.slice(1);

  const filteredDishes = useMemo(
    () => ONBOARDING_CUISINE_FOOD_CHOICES[currentCuisineId] || [],
    [currentCuisineId],
  );

  // Rebuild card anims when cuisine changes
  useEffect(() => {
    cardAnims.current = filteredDishes.map(() => new Animated.Value(0));

    fadeAnim.setValue(0);
    slideAnim.setValue(10);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    Animated.stagger(
      40,
      cardAnims.current.map((anim) =>
        Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ),
    ).start();
  }, [currentIndex, fadeAnim, filteredDishes, slideAnim]);

  const toggle = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentCuisineSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = [
      ...new Set([...(accumulatedSelectedIds || []), ...(currentCuisineSelectedIds || [])]),
    ];

    if (currentIndex < selectedCuisines.length - 1) {
      setAccumulatedSelectedIds(updated);
      setCurrentCuisineSelectedIds([]);
      setCurrentCuisineIndex(currentIndex + 1);
    } else {
      setOnboardingSelectedDishIds(updated);
      navigation.navigate("TasteQuiz");
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentCuisineIndex(currentIndex - 1);
      setCurrentCuisineSelectedIds([]);
    } else {
      navigation.goBack();
    }
  };

  const isNextDisabled =
    currentCuisineSelectedIds.length === 0 &&
    currentIndex === 0 &&
    accumulatedSelectedIds.length === 0;

  // Pair dishes into rows of 2
  const rows: (typeof filteredDishes)[] = [];
  for (let i = 0; i < filteredDishes.length; i += 2) {
    rows.push(filteredDishes.slice(i, i + 2));
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: H_PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ marginRight: 12 }}
            >
              <ArrowLeft color={palette.text} size={22} strokeWidth={2} />
            </Pressable>

            {/* Progress bar */}
            <View
              style={{
                flex: 1,
                height: 3,
                backgroundColor: palette.border,
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${((currentIndex + 1) / selectedCuisines.length) * 100}%`,
                  backgroundColor: palette.orange,
                  borderRadius: 99,
                }}
              />
            </View>

            <AppText
              style={{
                marginLeft: 12,
                color: palette.textSecondary,
                fontFamily: "Nunito_600SemiBold",
                fontSize: 12,
              }}
            >
              {currentIndex + 1}/{selectedCuisines.length}
            </AppText>
          </View>

          {/* Title */}
          <View style={{ marginBottom: 22 }}>
            <AppText
              style={{
                fontFamily: "Fraunces_700Bold",
                fontSize: 32,
                lineHeight: 38,
                color: palette.text,
                marginBottom: 6,
              }}
            >
              {`Your favourite\n${currentCuisineLabel} dishes?`}
            </AppText>
            <AppText style={{ color: palette.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Pick the ones that look good to you.
            </AppText>
          </View>
        </Animated.View>

        {/* Dish grid */}
        <View style={{ gap: GAP }}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: "row", gap: GAP }}>
              {row.map((dish, colIdx) => {
                const idx = rowIdx * 2 + colIdx;
                const anim = cardAnims.current[idx] ?? new Animated.Value(1);
                const isSelected =
                  currentCuisineSelectedIds.includes(dish.id) ||
                  accumulatedSelectedIds.includes(dish.id);
                return (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    isSelected={isSelected}
                    onPress={() => toggle(dish.id)}
                    enterAnim={anim}
                  />
                );
              })}
            </View>
          ))}
        </View>
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
        {currentCuisineSelectedIds.length > 0 && (
          <AppText
            style={{
              color: palette.orange,
              fontFamily: "Nunito_600SemiBold",
              fontSize: 13,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {currentCuisineSelectedIds.length} dish
            {currentCuisineSelectedIds.length !== 1 ? "es" : ""} selected
          </AppText>
        )}
        <Button
          label={currentIndex < selectedCuisines.length - 1 ? "Next Cuisine" : "Start Taste Quiz"}
          onPress={handleNext}
          disabled={isNextDisabled}
          variant="primary"
        />
      </View>
    </View>
  );
}
