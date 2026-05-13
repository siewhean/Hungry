import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Dices, ArrowRight } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DecideForMeCardProps = {
  compact?: boolean;
};

/**
 * Gradient orange "Decide for Me" card on the Discover screen.
 * Per Figma V2: full-width gradient card with dice icon, not a small button.
 */
export function DecideForMeCard({ compact = false }: DecideForMeCardProps) {
  const { spacing, radii } = useHungryTheme();
  const navigation = useNavigation<Nav>();

  return (
    <Pressable
      onPress={() => navigation.navigate("DecideForMeResult")}
      accessibilityRole="button"
      accessibilityLabel="Decide for me — let the Hungry wheel pick a dish"
      style={({ pressed }) => [
        styles.pressable,
        { opacity: pressed ? 0.92 : 1, borderRadius: radii.lg },
      ]}
    >
      <LinearGradient
        colors={["#E8531E", "#F59E0B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          { borderRadius: radii.lg, padding: compact ? spacing[4] : spacing[5] },
        ]}
      >
        <View style={[styles.row, { gap: compact ? spacing[3] : spacing[4] }]}>
          <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
            <Dices color="#FFFFFF" size={compact ? 24 : 32} />
          </View>
          <View style={[styles.textCol, { gap: spacing[1] }]}>
            <AppText
              variant={compact ? "bodyBold" : "h2"}
              style={{ color: "#FFFFFF", fontWeight: "800" }}
            >
              Decide for Me
            </AppText>
            <AppText
              variant={compact ? "micro" : "bodySmall"}
              numberOfLines={1}
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Can&apos;t choose? Let the Hungry wheel pick for you!
            </AppText>
          </View>
          <ArrowRight color="rgba(255,255,255,0.8)" size={compact ? 20 : 24} />
        </View>
      </LinearGradient>
    </Pressable>
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
