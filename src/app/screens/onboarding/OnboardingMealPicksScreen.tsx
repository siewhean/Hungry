import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NavigationProp } from "@react-navigation/native";
import { View } from "react-native";
import { Bell } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Card } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import {
  DEFAULT_MEAL_TIME,
  MEAL_LABELS,
  formatMealTime,
  previewMeal,
  pushTimeFor,
} from "@/features/onboarding/mealTimes";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { confirmHaptic, tapHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { registerForStallAlerts } from "@/lib/notifications/push";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingMealPicks">;

/** Screen 21: offers a lunch or dinner nudge shortly before the person usually eats. */
export function OnboardingMealPicksScreen({ navigation }: Props) {
  useOnboardingScreenViewed("meal-picks");
  const { palette, radii, spacing } = useHungryTheme();
  const mealTimes = useOnboardingAnswersStore((state) => state.mealTimes);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  // Lunch if they eat lunch out, then dinner; with neither picked the preview shows a lunch.
  const preview = previewMeal(mealTimes) ?? {
    meal: "lunch" as const,
    time: DEFAULT_MEAL_TIME.lunch,
  };
  const pushTime = pushTimeFor(preview.time);
  const mealName = MEAL_LABELS[preview.meal].toLowerCase();

  // A signed-in user (a returning account) finishes here; a guest goes on to create the account.
  const finish = () => {
    if (!isAuthenticated) {
      navigation.navigate(nextOnboardingRoute("OnboardingMealPicks", true));
      return;
    }
    const alreadyCompleted = useSessionStore.getState().hasCompletedOnboarding;
    useSessionStore.getState().completeOnboarding(hasSkippedTasteQuiz);
    if (alreadyCompleted) {
      navigation.getParent<NavigationProp<RootStackParamList>>()?.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Home" } }],
      });
    }
  };

  const turnOn = async () => {
    confirmHaptic();
    // The opt-in is kept even if the phone refuses: Settings shows why nothing arrives.
    useOnboardingAnswersStore.getState().setWantsMealPicks(true);
    try {
      await registerForStallAlerts({ askPermission: true });
    } catch (error) {
      // A guest has no account to store the token on yet; it is registered after sign-in.
      reportError(error, { screen: "OnboardingMealPicks", action: "ask_permission" });
    }
    finish();
  };

  return (
    <OnboardingFrame
      screen="meal-picks"
      onBack={() => navigation.goBack()}
      footer={
        <>
          <Button label="Turn on meal picks" onPress={() => void turnOn()} />
          <Button
            label="Not now"
            variant="ghost"
            onPress={() => {
              tapHaptic();
              useOnboardingAnswersStore.getState().setWantsMealPicks(false);
              finish();
            }}
          />
        </>
      }
    >
      <MascotLine
        pose="phone"
        lineId="meal-picks"
        text={`Want a nudge before ${mealName}? I will send three picks.`}
      />
      <Card
        accessible
        accessibilityLabel={`Example notification at ${formatMealTime(pushTime)}: ${mealName} ideas, three dishes picked for you`}
        style={{ borderRadius: radii.lg, padding: spacing[3] }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.orange,
              borderRadius: radii.md,
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <Bell color={palette.surface} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">{`Hungry · ${formatMealTime(pushTime)}`}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {`Three ideas for ${mealName}, picked for your taste.`}
            </AppText>
          </View>
        </View>
      </Card>
      <AppText variant="bodySmall" tone="secondary">
        Only on days you have not opened Hungry yet, and never more than once per meal. Switch it
        off any time in Settings.
      </AppText>
    </OnboardingFrame>
  );
}
