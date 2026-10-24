import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { FlowProgressBar } from "@/components/onboarding/FlowProgressBar";
import { FoodSwapStage } from "@/components/onboarding/FoodSwapStage";
import { TasteSlider } from "@/components/onboarding/TasteSlider";
import { TypingText } from "@/components/onboarding/TypingText";
import { AppText, Button } from "@/components/ui";
import { tasteFlowScreenAt } from "@/features/onboarding/onboardingFlow";
import {
  answerTaste,
  canSkipRest,
  emptyTasteDraft,
  isTasteAnswered,
  liveTasteLine,
  skipRemainingTastes,
  skipTaste,
  tasteVectorFromDraft,
  wasTasteSkipped,
  type TasteDraft,
} from "@/features/onboarding/tasteSliderAnswers";
import {
  NEUTRAL_SLIDER_VALUE,
  TASTE_SLIDER_AXES,
  TASTE_SLIDER_ORDER,
  describeStop,
  nearestStopIndex,
} from "@/features/onboarding/tasteSliderStops";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useHungryTheme } from "@/theme";
import { trackOnboardingStepSkipped, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz">;

const LAST_INDEX = TASTE_SLIDER_ORDER.length - 1;

/**
 * The taste questions as six sliders, one food picture per stop. Every question can be skipped; a
 * skipped taste keeps the neutral 5 and is passed on as "not set". Nothing is saved here: the draft
 * goes to the dietary step, which records the quiz.
 */
export function TasteSliderQuizScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const flowMode = route.params?.mode ?? "onboarding";
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<TasteDraft>(emptyTasteDraft);
  const [liveValue, setLiveValue] = useState(NEUTRAL_SLIDER_VALUE);
  const finishedRef = useRef(false);

  const key = TASTE_SLIDER_ORDER[index]!;
  const axis = TASTE_SLIDER_AXES[key];
  const answered = isTasteAnswered(draft, key);
  const stageSize = Math.min(240, Math.round(width * 0.6));

  const goToQuestion = useCallback((next: number, from: TasteDraft) => {
    const nextKey = TASTE_SLIDER_ORDER[next]!;
    setIndex(next);
    setLiveValue(from.values[nextKey]);
  }, []);

  useEffect(() => {
    if (index === 0) trackOnboardingStepViewed("taste");
    trackAnalyticsEvent("onboarding_question_viewed", {
      question: key,
      index,
      surface: "onboarding",
    });
  }, [index, key]);

  // Back (button, swipe or the Android key) steps to the previous question before it leaves the quiz.
  useEffect(() => {
    if (index === 0) return undefined;
    return navigation.addListener("beforeRemove", (event) => {
      if (finishedRef.current) return;
      event.preventDefault();
      goToQuestion(index - 1, draft);
    });
  }, [index, draft, navigation, goToQuestion]);

  const finish = (final: TasteDraft) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const answeredAny = !wasTasteSkipped(final);
    if (!answeredAny) trackOnboardingStepSkipped("taste");
    navigation.navigate("DietaryPreferences", {
      mode: flowMode,
      initialPhase: "dietary",
      ...(answeredAny
        ? { answers: tasteVectorFromDraft(final), answeredKeys: [...final.answered] }
        : {}),
    });
  };

  const advance = (next: TasteDraft) => {
    setDraft(next);
    if (index >= LAST_INDEX) finish(next);
    else goToQuestion(index + 1, next);
  };

  const stopIndex = nearestStopIndex(liveValue);
  const firstCaption = axis.stops[0].caption;
  const lastCaption = axis.stops[axis.stops.length - 1]!.caption;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 64,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (index > 0 ? goToQuestion(index - 1, draft) : navigation.goBack())}
          style={{
            alignItems: "center",
            height: 44,
            justifyContent: "center",
            width: 44,
          }}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <FlowProgressBar screen={tasteFlowScreenAt(index)} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[3] }}
        keyboardShouldPersistTaps="handled"
      >
        <TypingText lineId={`taste-${key}`} text={axis.question} />

        <FoodSwapStage
          stops={axis.stops}
          stopIndex={stopIndex}
          reduceMotion={reduceMotion}
          size={stageSize}
        />

        <View style={{ gap: spacing[1] }}>
          <TasteSlider
            value={draft.values[key]}
            unset={!answered}
            onMove={setLiveValue}
            onSettle={(value) => setDraft((current) => answerTaste(current, key, value))}
            accessibilityLabel={axis.question}
            accessibilityValueText={
              answered
                ? describeStop(key, stopIndex)
                : "Not set. Swipe up or down to choose, or skip for now."
            }
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText variant="micro" tone="secondary">
              {firstCaption}
            </AppText>
            <AppText variant="micro" tone="secondary">
              {lastCaption}
            </AppText>
          </View>
        </View>

        <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
          {answered ? liveTasteLine(key, liveValue) : "Slide to choose, or skip for now."}
        </AppText>
      </ScrollView>

      <View
        style={{
          gap: ONBOARDING_ACTIONS_GAP,
          paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING,
          paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
          paddingTop: spacing[3],
        }}
      >
        <Button
          label={index >= LAST_INDEX ? "Done" : "Continue"}
          disabled={!answered}
          onPress={() => advance(draft)}
        />
        <Button
          label="Skip for now"
          variant="ghost"
          onPress={() => advance(skipTaste(draft, key))}
        />
        {canSkipRest(index) ? (
          <Button
            label="Skip the rest, use my defaults"
            variant="ghost"
            onPress={() => {
              const next = skipRemainingTastes(draft, index);
              setDraft(next);
              finish(next);
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
