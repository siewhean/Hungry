import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, Dices, Utensils } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, Button, Screen } from "@/components/ui";
import {
  DECIDE_FOR_ME_OPTION_ID,
  DECIDE_QUESTIONS,
  type DecideAnswers,
} from "@/features/discovery/decideQuiz";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { selectHaptic, tapHaptic } from "@/lib/haptics";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import { DECIDE_OPTION_IMAGES } from "./decideOptionImages";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * A few quick questions before Decide for Me picks a dish: cuisine, rice or noodles, price and
 * flavour. Every question has "Decide for me", and the whole quiz can be skipped.
 */
export function DecideForMeQuizScreen() {
  const navigation = useNavigation<Navigation>();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  // Three cards per row inside the screen's spacing[4] gutters.
  const tileWidth = Math.floor((width - spacing[4] * 2 - spacing[2] * 2) / 3);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<DecideAnswers>({});
  const question = DECIDE_QUESTIONS[step];
  const isLast = step === DECIDE_QUESTIONS.length - 1;

  const finish = (finalAnswers: DecideAnswers) => {
    trackAnalyticsEvent("decide_for_me_triggered", {
      surface: "discover",
      answered: Object.values(finalAnswers).filter((id) => id !== DECIDE_FOR_ME_OPTION_ID).length,
    });
    // The result screen picks the dish; clear any earlier pick so it starts fresh.
    setDecideForMe(undefined);
    navigation.replace("DecideForMeResult", { surface: "discover", answers: finalAnswers });
  };

  const choose = (optionId: string) => {
    selectHaptic();
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (isLast) {
      finish(next);
      return;
    }
    setStep((current) => current + 1);
  };

  const skipAll = () => {
    tapHaptic();
    finish({});
  };

  return (
    <Screen
      title="Decide for me"
      onBackPress={() => {
        if (step > 0) {
          setStep((current) => current - 1);
          return;
        }
        navigation.goBack();
      }}
    >
      <View style={{ gap: spacing[5] }} testID="decide-quiz">
        <View style={{ gap: spacing[2] }}>
          <AppText tone="muted" variant="micro">
            {`QUESTION ${step + 1} OF ${DECIDE_QUESTIONS.length}`}
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing[1] }}>
            {DECIDE_QUESTIONS.map((item, index) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: index <= step ? palette.orange : palette.border,
                  borderRadius: radii.pill,
                  flex: 1,
                  height: 4,
                }}
              />
            ))}
          </View>
        </View>

        <AppText variant="h1" accessibilityRole="header">
          {question.title}
        </AppText>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {question.options.map((option) => {
            const isDecide = option.id === DECIDE_FOR_ME_OPTION_ID;
            const selected = answers[question.id] === option.id;
            const image = DECIDE_OPTION_IMAGES[option.id];
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => choose(option.id)}
                style={({ pressed }) => ({
                  backgroundColor: isDecide ? palette.orangeLight : palette.surface,
                  borderColor: selected || isDecide ? palette.orange : palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: selected ? 2 : 1,
                  overflow: "hidden",
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                  width: tileWidth,
                })}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: isDecide ? palette.orangeLight : palette.bgSoft,
                    height: tileWidth - 2,
                    justifyContent: "center",
                  }}
                >
                  {image ? (
                    <AccessibleImage
                      source={image}
                      decorative
                      contentFit="cover"
                      style={{ height: "100%", width: "100%" }}
                    />
                  ) : isDecide ? (
                    <Dices color={palette.orange} size={32} />
                  ) : (
                    <Utensils color={palette.textMuted} size={28} />
                  )}
                  {selected ? (
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: palette.orange,
                        borderRadius: radii.pill,
                        height: 24,
                        justifyContent: "center",
                        position: "absolute",
                        right: spacing[1.5],
                        top: spacing[1.5],
                        width: 24,
                      }}
                    >
                      <Check color={palette.textOnOrange} size={14} />
                    </View>
                  ) : null}
                </View>
                <AppText
                  variant="bodySmallBold"
                  numberOfLines={2}
                  style={{
                    color: isDecide ? palette.orangeDark : palette.text,
                    minHeight: 40,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[2],
                    textAlign: "center",
                  }}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Button label="Skip the questions" variant="ghost" onPress={skipAll} />
      </View>
    </Screen>
  );
}
