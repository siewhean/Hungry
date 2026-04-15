import { useMemo, useState, useEffect, useRef } from "react";
import { FlatList, Pressable, View, ScrollView, Animated } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Check, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AppText, Button, Screen } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<OnboardingStackParamList, "FoodSelection">;

// Improved mapping with distinct dishes
const CUISINE_MAP: Record<string, string[]> = {
  local: [
    "dish-chicken-rice",
    "dish-laksa",
    "dish-satay",
    "dish-stingray",
    "dish-char-kway-teow",
    "dish-lor-mee",
  ],
  japanese: ["dish-japanese-curry"],
  chinese: [
    "dish-yong-tau-foo",
    "dish-ban-mian",
    "dish-teochew-porridge",
    "dish-thunder-tea-rice",
    "dish-choon-kueh",
    "dish-fish-soup",
  ],
  thai: ["dish-sambal-seafood"],
  indian: ["dish-indian-rojak"],
  western: ["dish-claypot-rice"], // Mock placeholder
  malay: ["dish-satay", "dish-stingray"],
  korean: ["dish-japanese-curry"], // Mock placeholder
  italian: ["dish-kaya-toast"], // Mock placeholder
};

export function FoodSelectionScreen({ navigation, route }: Props) {
  const { motion, palette, spacing, radii, shadows } = useHungryTheme();
  const setOnboardingSelectedDishIds = useProfileStore(
    (s) => s.setOnboardingSelectedDishIds,
  );
  const selectedCuisines = route.params.cuisines;
  const repository = getDataRepository();

  const [currentIndex, setCurrentCuisineIndex] = useState(0);
  const [accumulatedSelectedIds, setAccumulatedSelectedIds] = useState<
    string[]
  >([]);
  const [currentCuisineSelectedIds, setCurrentCuisineSelectedIds] = useState<
    string[]
  >([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  const currentCuisineId = selectedCuisines[currentIndex];
  const currentCuisineLabel =
    currentCuisineId.charAt(0).toUpperCase() + currentCuisineId.slice(1);

  const filteredDishes = useMemo(() => {
    const dishIds = CUISINE_MAP[currentCuisineId] || [];
    return dishIds
      .map((id) => repository.getDishById(id))
      .filter(Boolean) as DishDetail[];
  }, [currentCuisineId, repository]);

  // Trigger transition animation when cuisine changes
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: motion.onboardingSlide,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: motion.onboardingSlide,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex, fadeAnim, motion.onboardingSlide, slideAnim]);

  const toggle = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentCuisineSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedAccumulated = [
      ...new Set([
        ...(accumulatedSelectedIds || []),
        ...(currentCuisineSelectedIds || []),
      ]),
    ];

    if (currentIndex < selectedCuisines.length - 1) {
      setAccumulatedSelectedIds(updatedAccumulated);
      setCurrentCuisineSelectedIds([]);
      setCurrentCuisineIndex(currentIndex + 1);
    } else {
      setOnboardingSelectedDishIds(updatedAccumulated);
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

  return (
    <Screen
      title={`Pick your ${currentCuisineLabel} cravings`}
      subtitle={`Step ${currentIndex + 1} of ${selectedCuisines.length}. Select dishes that look good to you.`}
      headerRight={
        <Pressable onPress={handleBack} style={{ padding: 8 }}>
          <ArrowLeft color={palette.text} size={24} />
        </Pressable>
      }
    >
      <View style={{ flex: 1, gap: spacing[6] }}>
        <View
          style={{
            height: 4,
            backgroundColor: palette.bgSoft,
            borderRadius: radii.pill,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${((currentIndex + 1) / selectedCuisines.length) * 100}%`,
              backgroundColor: palette.orange,
            }}
          />
        </View>

        <Animated.View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing[4],
            justifyContent: "space-between",
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {filteredDishes.length > 0 ? (
            filteredDishes.map((dish) => {
              const isSelected =
                currentCuisineSelectedIds.includes(dish.id) ||
                accumulatedSelectedIds.includes(dish.id);
              return (
                <Pressable
                  key={dish.id}
                  onPress={() => toggle(dish.id)}
                  style={[
                    shadows.card,
                    {
                      width: "47%",
                      backgroundColor: palette.surface,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      borderWidth: 2,
                      borderColor: isSelected ? palette.orange : palette.border,
                    },
                  ]}
                >
                  <View
                    style={{ height: 120, width: "100%", position: "relative" }}
                  >
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: spacing[2],
                        right: spacing[2],
                        width: 28,
                        height: 28,
                        borderRadius: radii.pill,
                        backgroundColor: isSelected
                          ? palette.orange
                          : palette.surfaceTranslucent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <Check
                          size={16}
                          color={palette.surface}
                          strokeWidth={3}
                        />
                      )}
                    </View>
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="bodyBold" numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>
                      {dish.venueName}
                    </AppText>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View
              style={{ flex: 1, padding: spacing[8], alignItems: "center" }}
            >
              <AppText tone="secondary">
                No {currentCuisineLabel} dishes found.
              </AppText>
            </View>
          )}
        </Animated.View>

        <Button
          label={
            currentIndex < selectedCuisines.length - 1
              ? "Next Cuisine"
              : "Start Taste Quiz"
          }
          onPress={handleNext}
          disabled={
            currentCuisineSelectedIds.length === 0 &&
            currentIndex === 0 &&
            accumulatedSelectedIds.length === 0
          }
          variant="primary"
        />
      </View>
    </Screen>
  );
}
