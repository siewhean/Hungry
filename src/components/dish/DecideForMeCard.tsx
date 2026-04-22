import { Animated, Pressable, View } from "react-native";
import { useRef, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Shuffle } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface DecideForMeCardProps {
  onPress?: () => void;
}

/**
 * Branded orange-to-amber gradient "Decide For Me" card.
 * Per Figma V2: full-width gradient with pulse animation, Shuffle icon, chevron right.
 * Can be used standalone with no required props.
 */
export function DecideForMeCard({ onPress }: DecideForMeCardProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Decide for me" onPress={onPress}>
        <LinearGradient
          colors={[palette.orange, palette.amber]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            shadows.card,
            {
              borderRadius: radii.xl,
              padding: spacing[5],
              minHeight: 100,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
            <Shuffle color={palette.white} size={28} />
            <View>
              <AppText variant="h2" tone="inverse">
                Decide For Me
              </AppText>
              <AppText variant="bodySmall" tone="inverse" style={{ opacity: 0.9 }}>
                Single-player pick
              </AppText>
            </View>
          </View>
          <ChevronRight color={palette.white} size={24} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
