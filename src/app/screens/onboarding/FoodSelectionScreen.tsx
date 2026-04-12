import { useMemo, useState, useEffect, useRef } from "react";
import { FlatList, Pressable, View, ScrollView, Animated } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Check, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AppText, Button, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<OnboardingStackParamList, "FoodSelection">;

// Improved mapping with distinct dishes
const CUISINE_MAP: Record<string, string[]> = {
  local: ["dish-chicken-rice", "dish-laksa", "dish-satay", "dish-stingray", "dish-char-kway-teow", "dish-lor-mee"],
  japanese: ["dish-japanese-curry"],
  chinese: ["dish-yong-tau-foo", "dish-ban-mian", "dish-teochew-porridge", "dish-thunder-tea-rice", "dish-choon-kueh", "dish-fish-soup"],
  thai: ["dish-sambal-seafood"],
  indian: ["dish-indian-rojak"],
  western: ["dish-claypot-rice"], // Mock placeholder
  malay: ["dish-satay", "dish-stingray"],
  korean: ["dish-japanese-curry"], // Mock placeholder
  italian: ["dish-kaya-toast"], // Mock placeholder
};

export function FoodSelectionScreen({ navigation, route }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const setOnboardingSelectedDishIds = useProfileStore((s) => s.setOnboardingSelectedDishIds);
  const selectedCuisines = route.params.cuisines;

  const [currentIndex, setCurrentCuisineIndex] = useState(0);
  const [accumulatedSelectedIds, setAccumulatedSelectedIds] = useState<string[]>([]);
  const [currentCuisineSelectedIds, setCurrentCuisineSelectedIds] = useState<string[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  const currentCuisineId = selectedCuisines[currentIndex];
  const currentCuisineLabel = currentCuisineId.charAt(0).toUpperCase() + currentCuisineId.slice(1);

  const filteredDishes = useMemo(() => {
    const dishIds = CUISINE_MAP[currentCuisineId] || [];
    return dishIds.map(id => mockRepository.getDishById(id)).filter(Boolean) as DishDetail[];
  }, [currentCuisineId]);

  // Trigger transition animation when cuisine changes
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
  }, [currentIndex]);

  const toggle = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentCuisineSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedAccumulated = [...new Set([...(accumulatedSelectedIds || []), ...(currentCuisineSelectedIds || [])])];
    
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
        <View style={{ height: 4, backgroundColor: palette.bgSoft, borderRadius: 2, overflow: "hidden" }}>
          <View style={{ 
            height: "100%", 
            width: `${((currentIndex + 1) / selectedCuisines.length) * 100}%`, 
            backgroundColor: palette.orange 
          }} />
        </View>

        <Animated.View style={{ 
          flexDirection: "row", 
          flexWrap: "wrap", 
          gap: spacing[4], 
          justifyContent: "space-between",
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {filteredDishes.length > 0 ? (
            filteredDishes.map((dish) => {
              const isSelected = currentCuisineSelectedIds.includes(dish.id) || accumulatedSelectedIds.includes(dish.id);
              return (
                <Pressable
                  key={dish.id}
                  onPress={() => toggle(dish.id)}
                  style={[
                    shadows.card,
                    { 
                      width: "47%", 
                      backgroundColor: palette.surface, 
                      borderRadius: 24, 
                      overflow: "hidden",
                      borderWidth: 2,
                      borderColor: isSelected ? palette.orange : palette.border,
                    }
                  ]}
                >
                  <View style={{ height: 120, width: "100%", position: "relative" }}>
                    <Image source={{ uri: dish.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <View style={{ 
                      position: "absolute", top: 8, right: 8, 
                      width: 28, height: 28, borderRadius: 14, 
                      backgroundColor: isSelected ? palette.orange : "rgba(255,255,255,0.8)", 
                      alignItems: "center", justifyContent: "center" 
                    }}>
                      {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                  </View>
                  <View style={{ padding: spacing[3], gap: 2 }}>
                    <AppText style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1}>{dish.name}</AppText>
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>{dish.venueName}</AppText>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={{ flex: 1, padding: spacing[8], alignItems: "center" }}>
              <AppText tone="secondary">No {currentCuisineLabel} dishes found.</AppText>
            </View>
          )}
        </Animated.View>

        <Button
          label={currentIndex < selectedCuisines.length - 1 ? "Next Cuisine" : "Start Taste Quiz"}
          onPress={handleNext}
          disabled={currentCuisineSelectedIds.length === 0 && currentIndex === 0 && accumulatedSelectedIds.length === 0}
          variant="primary"
        />
      </View>
    </Screen>
  );
}
