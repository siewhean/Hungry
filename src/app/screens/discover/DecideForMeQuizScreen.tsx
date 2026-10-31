import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  findNodeHandle,
  useWindowDimensions,
} from "react-native";
import {
  usePreventRemove,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Dices } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { LocationGate } from "@/components/discover/LocationGate";
import {
  AccessibleImage,
  AppSymbol,
  AppText,
  Button,
  PressableScale,
  Screen,
} from "@/components/ui";
import {
  DECIDE_FOR_ME_OPTION_ID,
  DECIDE_QUESTIONS,
  type DecideAnswers,
} from "@/features/discovery/decideQuiz";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getExperimentVariant } from "@/lib/experiments/experiments";
import { selectHaptic, tapHaptic } from "@/lib/haptics";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { DECIDE_OPTION_IMAGES, DECIDE_PRICE_TIERS } from "./decideOptionImages";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** Taps this soon after a step change are ignored, so a double tap cannot answer the next question. */
const STEP_TAP_GUARD_MS = 250;
/** Two lines of label plus padding, so a one-line "Rice" tile is as tall as "Japanese or Korean". */
const TILE_LABEL_HEIGHT = 56;

/**
 * A few quick questions before Decide for Me picks a dish: cuisine, rice or noodles, price and
 * flavour. Every question has "Decide for me", and the whole quiz can be skipped.
 */
export function DecideForMeQuizScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, "DecideForMeQuiz">>();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { fontScale, width } = useWindowDimensions();
  // Three cards per row inside the screen's spacing[4] gutters; two at large text sizes so the
  // labels are not cut off.
  const columns = fontScale >= 1.3 ? 2 : 3;
  const tileWidth = Math.floor((width - spacing[4] * 2 - spacing[2] * (columns - 1)) / columns);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  // Everyone who renders this screen sees the variant. Read once at first render: exposure is
  // recorded only if flags have already loaded, and only for the arm actually shown, so a late
  // flag load can neither change the question count mid-quiz nor expose an unseen arm.
  const [questions] = useState(() =>
    getExperimentVariant("decide_quiz_v1", { expose: true }) === "two_questions"
      ? DECIDE_QUESTIONS.filter((item) => item.id === "cuisine" || item.id === "price")
      : DECIDE_QUESTIONS,
  );
  const locationPermission = useLocationStore((state) => state.permission);
  const gpsLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  // No fix and no picked place: ask before the questions, not after the diner answered them all.
  const needsLocation = getEffectiveLocation({
    permission: locationPermission,
    currentLocation: gpsLocation,
    manualCoordinate,
  }).isApproximate;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<DecideAnswers>(() => route.params?.answers ?? {});
  const question = questions[step];
  const gridOptions = question.options.filter((option) => option.id !== DECIDE_FOR_ME_OPTION_ID);
  const openOption = question.options.find((option) => option.id === DECIDE_FOR_ME_OPTION_ID);
  const isLast = step === questions.length - 1;
  const finishedRef = useRef(false);
  const lastStepChangeRef = useRef(0);
  const pendingStepRef = useRef(step);
  const headerRef = useRef<View>(null);

  // The answers the quiz finished with. The replace to the result runs in an effect after this
  // is set, once usePreventRemove below has switched off, so the last answer is never blocked.
  const [finishedWith, setFinishedWith] = useState<DecideAnswers | null>(null);

  // System back (Android button, iOS swipe) steps back through the questions like the header
  // back button, instead of leaving the quiz from any step. usePreventRemove (not a bare
  // beforeRemove listener) is what sets native-stack's preventNativeDismiss, so the iOS swipe is
  // stopped natively instead of dismissing the screen while it stays in the JS stack.
  usePreventRemove(step > 0 && finishedWith === null, () => {
    setStep((current) => Math.max(0, current - 1));
  });

  useEffect(() => {
    if (!finishedWith) return;
    navigation.replace("DecideForMeResult", { surface: "discover", answers: finishedWith });
  }, [finishedWith, navigation]);

  // A screen reader hears the new question; focus would otherwise stay on a tile that now
  // stands for a different answer.
  const firstStepRef = useRef(true);
  useEffect(() => {
    lastStepChangeRef.current = Date.now();
    pendingStepRef.current = step;
    if (firstStepRef.current) {
      firstStepRef.current = false;
      return;
    }
    const announcement = `Question ${step + 1} of ${questions.length}. ${questions[step].title}`;
    AccessibilityInfo.announceForAccessibility(announcement);
    // findNodeHandle is native only; on web the announcement above reads the new question.
    if (Platform.OS === "web") return;
    const node = headerRef.current ? findNodeHandle(headerRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [questions, step]);

  // Where people leave the quiz: one event per question reached, once the location prompt is out
  // of the way. The question count is read from a ref so a flag that loads later does not repeat it.
  const questionCountRef = useRef(questions.length);
  questionCountRef.current = questions.length;
  const stepViewReady = !(needsLocation && step === 0);
  useEffect(() => {
    if (!stepViewReady) return;
    trackAnalyticsEvent("decide_quiz_step_viewed", {
      step: step + 1,
      questions: questionCountRef.current,
    });
  }, [step, stepViewReady]);

  const finish = (finalAnswers: DecideAnswers, skipped: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Discover already sent decide_for_me_triggered for this flow; this is the quiz's own event.
    trackAnalyticsEvent("decide_quiz_completed", {
      skipped,
      answered: Object.values(finalAnswers).filter((id) => id !== DECIDE_FOR_ME_OPTION_ID).length,
      questions: questions.length,
      cuisine: finalAnswers.cuisine,
      staple: finalAnswers.staple,
      price: finalAnswers.price,
      flavour: finalAnswers.flavour,
    });
    // The result screen picks the dish; clear any earlier pick so it starts fresh.
    setDecideForMe(undefined);
    setFinishedWith(finalAnswers);
  };

  const choose = (optionId: string) => {
    if (finishedRef.current) return;
    // A second tap before the next question has rendered, or within the guard time after it
    // appeared, is the same double tap and is ignored.
    if (pendingStepRef.current !== step) return;
    if (step > 0 && Date.now() - lastStepChangeRef.current < STEP_TAP_GUARD_MS) return;
    selectHaptic();
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (isLast) {
      finish(next, false);
      return;
    }
    pendingStepRef.current = step + 1;
    setStep(step + 1);
  };

  const skipAll = () => {
    tapHaptic();
    finish({}, true);
  };

  if (needsLocation && step === 0) {
    return (
      <Screen title="Decide for me" onBackPress={() => navigation.goBack()}>
        <LocationGate
          source="decide"
          title="Where are you eating?"
          body="Decide for me picks a dish near you, so it needs to know where you are. It is only used to find food near you."
        />
      </Screen>
    );
  }

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
            {`QUESTION ${step + 1} OF ${questions.length}`}
          </AppText>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Quiz progress"
            accessibilityValue={{ min: 0, max: questions.length, now: step + 1 }}
            style={{ flexDirection: "row", gap: spacing[1] }}
          >
            {questions.map((item, index) => (
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

        <View ref={headerRef} accessible accessibilityRole="header">
          <AppText variant="h1">{question.title}</AppText>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {gridOptions.map((option) => {
            const selected = answers[question.id] === option.id;
            const image = DECIDE_OPTION_IMAGES[option.id];
            const priceTier = DECIDE_PRICE_TIERS[option.id];
            return (
              <PressableScale
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => choose(option.id)}
                style={{
                  backgroundColor: palette.surface,
                  borderColor: selected ? palette.orange : palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: selected ? 2 : 1,
                  overflow: "hidden",
                  width: tileWidth,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.bgSoft,
                    height: Math.min(tileWidth - 2, 140),
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
                  ) : priceTier ? (
                    <AppText
                      testID={`decide-price-tier-${option.id}`}
                      variant="h1"
                      style={{ color: palette.text }}
                    >
                      {priceTier}
                    </AppText>
                  ) : (
                    <AppSymbol name="noPhoto" color={palette.textMuted} size={28} />
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
                      <AppSymbol name="selected" color={palette.textOnOrange} size={14} />
                    </View>
                  ) : null}
                </View>
                <View
                  // One fixed height, so a two-line label never makes its row taller than the next.
                  style={{
                    justifyContent: "center",
                    height: TILE_LABEL_HEIGHT,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[2],
                  }}
                >
                  <AppText
                    variant="bodySmallBold"
                    // The tile's accessibility label carries the full text if a large type size cuts it.
                    numberOfLines={2}
                    style={{ color: palette.text, textAlign: "center" }}
                  >
                    {option.label}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>

        {openOption ? (
          // The open answer is a plain row under the grid, not a tile that competes with the foods.
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Any is fine"
            accessibilityState={{ selected: answers[question.id] === openOption.id }}
            onPress={() => choose(openOption.id)}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: answers[question.id] === openOption.id ? palette.orange : palette.border,
              borderRadius: componentRadii.card,
              borderWidth: answers[question.id] === openOption.id ? 2 : 1,
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              minHeight: 52,
              paddingHorizontal: spacing[4],
            }}
          >
            <AppSymbol name="dice" fallback={Dices} color={palette.textSecondary} size={20} />
            <AppText variant="bodyBold">Any is fine</AppText>
          </PressableScale>
        ) : null}

        <Button label="Skip the questions" variant="ghost" onPress={skipAll} />
      </View>
    </Screen>
  );
}
