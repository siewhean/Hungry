import { Animated, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Dices, ArrowRight, Shuffle } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Nav = NativeStackNavigationProp<RootStackParamList>;
export type DecideForMeCardProps = {
  compact?: boolean;
  onPress?: () => void;
  animatePulse?: boolean;
};

/**
 * Gradient orange "Decide for Me" card on the Discover screen.
 * Per Figma V2: full-width gradient card with dice icon, not a small button.
 */
export function DecideForMeCard({
  compact = false,
  onPress,
  animatePulse = false,
}: DecideForMeCardProps) {
  const { componentRadii, spacing, palette } = useHungryTheme();
  const navigation = useNavigation<Nav>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shouldPulse = animatePulse;

  useEffect(() => {
    if (!shouldPulse) return;

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
  }, [pulseAnim, shouldPulse]);

  const handlePress = onPress ?? (() => navigation.navigate("DecideForMeResult"));

  return (
    <Animated.View style={{ transform: [{ scale: shouldPulse ? pulseAnim : 1 }] }}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Decide for me — let the Hungry wheel pick a dish"
        style={({ pressed }) => [
          styles.pressable,
          { opacity: pressed ? 0.92 : 1, borderRadius: componentRadii.button },
        ]}
      >
        <LinearGradient
          colors={[palette.orange, palette.amber]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { borderRadius: componentRadii.button, padding: compact ? spacing[4] : spacing[5] },
          ]}
        >
          <View style={[styles.row, { gap: compact ? spacing[3] : spacing[4] }]}>
            <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
              {shouldPulse ? (
                <Shuffle color={palette.white} size={compact ? 24 : 28} />
              ) : (
                <Dices color={palette.white} size={compact ? 24 : 32} />
              )}
            </View>
            <View style={[styles.textCol, { gap: spacing[1] }]}>
              <AppText
                variant={compact ? "bodyBold" : "h2"}
                style={{ color: palette.white, fontWeight: "800" }}
              >
                Decide for Me
              </AppText>
              <AppText
                variant={compact ? "micro" : "bodySmall"}
                numberOfLines={2}
                style={{ color: palette.textSecondary }}
              >
                Can&apos;t choose? Let the Hungry wheel pick for you!
              </AppText>
            </View>
            <ArrowRight color={palette.white} size={compact ? 20 : 24} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    overflow: "hidden",
  },
  gradient: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  textCol: {
    flex: 1,
  },
});
