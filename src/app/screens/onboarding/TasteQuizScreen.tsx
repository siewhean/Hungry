import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { Button, AppText } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { TasteVector } from "@/types/domain";
import { OnboardingScreenShell } from "./OnboardingScreenShell";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz">;

const INITIAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

const QUESTIONS = {
  sweet: "How much do you love sweet food?",
  spicy: "How spicy do you like your food?",
  sour: "Can you handle a strong sour punch?",
  salty: "How salty do you prefer your dishes?",
  rich: "Do you prefer rich, heavy flavours?",
  aromatic: "How important are fragrant herbs and spices?",
} as const;

const LABELS = {
  sweet: ["Not sweet", "Balanced", "Very sweet"],
  spicy: ["Mild please", "Some heat", "Bring the fire"],
  sour: ["Avoid sour", "A little", "Love it sour"],
  salty: ["Low sodium", "Just right", "Salt everything"],
  rich: ["Light & fresh", "Mix", "Rich & hearty"],
  aromatic: ["Plain", "Moderate", "Very fragrant"],
} as const;

const STEPS = TASTE_DIMENSIONS.map((d) => d.key);

const OPTIONS = [2, 5, 8] as const;

export function TasteQuizScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const setSkippedTasteQuiz = useSessionStore((state) => state.setSkippedTasteQuiz);
  const updateTasteVector = useProfileStore((state) => state.updateTasteVector);
  const [values, setValues] = useState<TasteVector>(INITIAL);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentKey = STEPS[step];
  const dimension = TASTE_DIMENSIONS[step];
  const [low, mid, high] = LABELS[currentKey];

  const progress = (step + 1) / STEPS.length;

  const animateNext = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  };

  const selectValue = (value: number) => {
    setValues((prev) => ({ ...prev, [currentKey]: value }));
    if (step < STEPS.length - 1) {
      animateNext(step + 1);
    }
  };

  const handleFinish = () => {
    updateTasteVector(values);
    setSkippedTasteQuiz(false);
    navigation.navigate("DietaryPreferences");
  };

  const isLast = step === STEPS.length - 1;
  const currentValue = values[currentKey];

  return (
    <OnboardingScreenShell
      title="Taste quiz"
      subtitle="Six questions — tell us your flavour DNA."
      stepLabel="Step 1 of 3"
    >
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      <AppText variant="micro" tone="muted" style={{ textAlign: "right" }}>
        {step + 1} / {STEPS.length}
      </AppText>

      {/* Question card */}
      <Animated.View style={[styles.card, { backgroundColor: palette.surface, borderRadius: radii.lg, opacity: fadeAnim }]}>
        <View style={styles.legendRow}>
          <AppText variant="micro" tone="muted">
            LOW
          </AppText>
          <AppText variant="micro" tone="muted">
            BALANCED
          </AppText>
          <AppText variant="micro" tone="muted">
            HIGH
          </AppText>
        </View>

        <AppText variant="h2" style={styles.question}>
          {QUESTIONS[currentKey]}
        </AppText>

        <AppText tone="muted" variant="bodySmall" style={styles.dimName}>
          {dimension.label}
        </AppText>

        {/* Choice buttons */}
        <View style={styles.optionRow}>
          {OPTIONS.map((opt, i) => {
            const isSelected = currentValue === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => selectValue(opt)}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: isSelected ? palette.orange : palette.bgSoft,
                    borderColor: isSelected ? palette.orange : palette.border,
                    borderRadius: radii.lg,
                  },
                ]}
              >
                <AppText
                  variant="bodySmall"
                  style={{ color: isSelected ? "#FFFFFF" : palette.text, textAlign: "center" }}
                >
                  {i === 0 ? low : i === 1 ? mid : high}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Navigation buttons */}
      <View style={{ gap: spacing[3] }}>
        {isLast ? (
          <Button label="Build my taste profile →" onPress={handleFinish} />
        ) : (
          <Button
            label="Next"
            onPress={() => animateNext(step + 1)}
            variant="secondary"
          />
        )}
        {step > 0 && (
          <Button label="Back" variant="ghost" onPress={() => animateNext(step - 1)} />
        )}
        <Button
          label="Skip quiz"
          variant="ghost"
          onPress={() => {
            setSkippedTasteQuiz(true);
            navigation.navigate("DietaryPreferences");
          }}
        />
      </View>
    </OnboardingScreenShell>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    height: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  card: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  question: {
    textAlign: "center",
  },
  dimName: {
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  optionChip: {
    alignItems: "center",
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
});
