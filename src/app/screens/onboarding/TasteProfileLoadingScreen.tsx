import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileLoading">;

export function TasteProfileLoadingScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => navigation.replace("TasteProfileResult"));
  }, [navigation, progress]);

  return (
    <View style={{ alignItems: "center", backgroundColor: palette.bg, flex: 1, justifyContent: "center", padding: spacing[6] }}>
      <AppText variant="h2" style={{ marginBottom: spacing[3], textAlign: "center" }}>
        Building your taste profile
      </AppText>
      <AppText variant="bodySmall" tone="secondary" style={{ marginBottom: spacing[5], textAlign: "center" }}>
        Matching flavour signals with your preferences.
      </AppText>
      <View
        style={{
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          height: 10,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <Animated.View
          style={{
            backgroundColor: palette.orange,
            height: "100%",
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
}
