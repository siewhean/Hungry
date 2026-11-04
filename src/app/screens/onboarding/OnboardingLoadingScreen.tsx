import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Check } from "lucide-react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button } from "@/components/ui";
import {
  LOADING_TIMEOUT_MS,
  TIP_INTERVAL_MS,
  tipAt,
  withTimeout,
} from "@/features/onboarding/loadingTips";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { successHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { loadOnboardingDishPool } from "./tastePicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingLoading">;

/**
 * The first two steps are answers already on the phone, so they show done at once; the last one is
 * the real request, and the screen moves on the moment it finishes. There is no timed wait.
 */
const STEPS = ["Reading your taste", "Checking your diet and budget", "Finding dishes near you"];

/** Screen 19: ranks the dishes. Leaves the stack when done, so Back from the results skips it. */
export function OnboardingLoadingScreen({ navigation }: Props) {
  useOnboardingScreenViewed("loading");
  const { palette, radii, spacing } = useHungryTheme();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    withTimeout(loadOnboardingDishPool(), LOADING_TIMEOUT_MS)
      .then(() => {
        if (!active) return;
        successHaptic();
        navigation.replace("OnboardingResults");
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "OnboardingLoading", action: "rank_dishes" });
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, navigation]);

  useEffect(() => {
    const timer = setInterval(() => setTick((count) => count + 1), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <OnboardingFrame screen="loading" onBack={() => navigation.goBack()}>
      <MascotLine
        pose="cooking"
        lineId="loading"
        text="Give me a second. I am picking dishes for you."
      />
      <View style={{ gap: spacing[3], paddingVertical: spacing[3] }}>
        {STEPS.map((step, index) => {
          const done = index < STEPS.length - 1;
          return (
            <View
              key={step}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}
            >
              <View
                style={{ alignItems: "center", height: 24, justifyContent: "center", width: 24 }}
              >
                {done ? (
                  <Check color={palette.success} size={20} />
                ) : failed ? null : (
                  <ActivityIndicator color={palette.orange} size="small" />
                )}
              </View>
              <AppText variant="body">{step}</AppText>
            </View>
          );
        })}
      </View>
      {failed ? (
        <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            {"This is taking longer than it should. You can try again or carry on."}
          </AppText>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAttempt((count) => count + 1)}
          />
          <Button
            label="Carry on"
            variant="ghost"
            fullWidth={false}
            onPress={() => navigation.replace("OnboardingResults")}
          />
        </View>
      ) : (
        <View
          style={{
            backgroundColor: palette.orangeLight,
            borderRadius: radii.md,
            padding: spacing[3],
          }}
        >
          <AppText variant="bodySmall" accessibilityLiveRegion="polite">
            {tipAt(tick)}
          </AppText>
        </View>
      )}
    </OnboardingFrame>
  );
}
