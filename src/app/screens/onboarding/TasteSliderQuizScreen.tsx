import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { FoodSwapStage } from "@/components/onboarding/FoodSwapStage";
import { TasteSlider } from "@/components/onboarding/TasteSlider";
import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button } from "@/components/ui";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { poseForScreen } from "@/features/onboarding/mascot";
import { tasteFlowScreenAt } from "@/features/onboarding/onboardingFlow";
import {
  answerTaste,
  canSkipRest,
  draftFromStoredQuiz,
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
import { tapHaptic } from "@/lib/haptics";
import { getFreshOnboardingDraft, useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useHungryTheme } from "@/theme";
import { trackOnboardingStepSkipped, trackOnboardingStepViewed } from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz">;

const LAST_INDEX = TASTE_SLIDER_ORDER.length - 1;

/**
 * The taste questions as six sliders, one food picture per stop. Every question can be skipped; a
 * skipped taste keeps the neutral 5 and is passed on as "not set". Nothing is saved here: the draft
 * goes to the dietary step, which records the quiz.
 */
export function TasteSliderQuizScreen({ navigation, route }: Props) {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const flowMode = route.params?.mode ?? "onboarding";
  // A relaunch reopens the quiz with the answers given so far (a draft under 24 hours old).
  const [stored] = useState(() =>
    flowMode === "onboarding" ? getFreshOnboardingDraft()?.quiz : null,
  );
  const [index, setIndex] = useState(() =>
    stored ? Math.max(0, Math.min(LAST_INDEX, stored.step)) : 0,
  );
  const [draft, setDraft] = useState<TasteDraft>(() =>
    stored ? draftFromStoredQuiz(stored) : emptyTasteDraft(),
  );
  const [liveValue, setLiveValue] = useState(() =>
    stored ? draftFromStoredQuiz(stored).values[TASTE_SLIDER_ORDER[index]!] : NEUTRAL_SLIDER_VALUE,
  );
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

  // Keep the answers given so far, so closing the app mid-quiz does not lose them.
  useEffect(() => {
    if (flowMode !== "onboarding") return;
    useOnboardingDraftStore.getState().rememberQuiz({
      answers: tasteVectorFromDraft(draft),
      answeredKeys: [...draft.answered],
      step: index,
    });
  }, [draft, flowMode, index]);

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
    // The dietary step reads the answers from the draft, not from route params.
    useOnboardingDraftStore.getState().rememberQuiz({
      answers: tasteVectorFromDraft(final),
      answeredKeys: [...final.answered],
      step: index,
    });
    navigation.navigate(nextOnboardingRoute("TasteQuiz", true));
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
    <OnboardingFrame
      screen={tasteFlowScreenAt(index)}
      onBack={() => (index > 0 ? goToQuestion(index - 1, draft) : navigation.goBack())}
      footer={
        <>
          <Button
            label={index >= LAST_INDEX ? "Done" : "Continue"}
            disabled={!answered}
            onPress={() => {
              tapHaptic();
              advance(draft);
            }}
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
        </>
      }
    >
      <MascotLine
        small
        pose={poseForScreen(tasteFlowScreenAt(index))}
        lineId={`taste-${key}`}
        text={axis.question}
      />

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
    </OnboardingFrame>
  );
}
