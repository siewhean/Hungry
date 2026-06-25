import { useState, useRef, useEffect } from "react";
import { Pressable, View, Animated, ScrollView, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccessibleImage, AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ONBOARDING_CUISINES } from "./onboardingFoodImages";

type Props = NativeStackScreenProps<OnboardingStackParamList, "CuisineSelection">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const CARD_H = CARD_W * 1.3;

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
        }}
      >
        <AccessibleImage
          source={cuisine.imageSource}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          decorative
        />
        {/* Dark scrim at bottom */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "55%",
            backgroundColor: "rgba(0,0,0,0.52)",
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
            color: palette.textOnDark,
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
          {isSelected && <Check size={13} color={palette.textOnDark} strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function CuisineSelectionScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);

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

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("FoodSelection", { cuisines: selected });
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
            Pick your go-to cuisines to shape your feed.
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
