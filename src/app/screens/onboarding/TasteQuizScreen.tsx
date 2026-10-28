import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Easing,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, Button, AppText } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { recordQuizResponse } from "@/features/profile/pendingQuizResponse";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { getFreshOnboardingDraft, useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, TasteKey, TasteVector } from "@/types/domain";
import { DietaryStep } from "./DietaryStep";
import {
  OnboardingProgress,
  trackOnboardingQuestionViewed,
  trackOnboardingStepSkipped,
  trackOnboardingStepViewed,
} from "./OnboardingProgress";
import type { OnboardingStackParamList } from "./OnboardingStack";
import {
  ONBOARDING_ACTIONS_BOTTOM_PADDING,
  ONBOARDING_ACTIONS_GAP,
  ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
} from "./layoutConstants";
import { TASTE_QUESTION_FOODS } from "./onboardingFoodImages";
import { TasteOptionTiles } from "./TasteOptionTiles";
import {
  TASTE_ANSWER_OPTIONS,
  hasAnsweredAnyQuestion,
  resolveQuestionCard,
} from "./tasteQuizAnswers";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteQuiz" | "DietaryPreferences">;

const INITIAL: TasteVector = NEUTRAL_TASTE_VECTOR;

// Stable preferences, not tonight's mood: the answers are saved as the taste profile.
const QUESTIONS = {
  sweet: "How sweet do you like your food?",
  spicy: "How spicy do you usually go?",
  sour: "How much sourness do you enjoy?",
  salty: "How salty do you like it?",
  rich: "How rich do you like your food?",
  aromatic: "How fragrant do you like it?",
} as const;

const STEPS = TASTE_DIMENSIONS.map((d) => d.key);

const OPTIONS = TASTE_ANSWER_OPTIONS;
const BACK_BUTTON_WIDTH = "30%" as const;
const PRIMARY_BUTTON_WIDTH = "54%" as const;
const OPTIONS_VERTICAL_GAP_UNITS = 6;

const LABELS = {
  sweet: ["Light", "Balanced", "Sweet-forward"],
  spicy: ["Mild", "Medium", "Fiery"],
  sour: ["Subtle", "Balanced", "Punchy"],
  salty: ["Light", "Balanced", "Bold"],
  rich: ["Light", "Balanced", "Rich"],
  aromatic: ["Subtle", "Balanced", "Intense"],
} as const;

/** The three questions that move recommendations most (test arm of onboarding_quiz_length_v1). */
const SHORT_STEPS: TasteKey[] = ["spicy", "sweet", "rich"];
/** Time to see the picked tile before the next question fades in. */
const AUTO_ADVANCE_MS = 400;
/** Each half of the crossfade between questions: 200 ms in all, never an empty screen. */
const STEP_FADE_MS = 100;

export function TasteQuizScreen({ navigation, route }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { fontScale, height, width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  // A screen reader user moves on with Next: an answer that auto-advances would skip its readout.
  const [screenReaderOn, setScreenReaderOn] = useState(false);
  // Not on web: react-native-web reports a screen reader as always on.
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active) setScreenReaderOn(enabled);
      })
      .catch((error) =>
        reportError(error, { screen: "TasteQuiz", action: "read_screen_reader_state" }),
      );
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) =>
      setScreenReaderOn(Boolean(enabled)),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const fadeDuration = reduceMotion ? 0 : STEP_FADE_MS;
  const setTasteVector = useProfileStore((state) => state.setTasteVector);
  const profile = useProfileStore((state) => state.profile);
  const setDietaryPreferences = useProfileStore((state) => state.setDietaryPreferences);
  const setMaxDishBudget = useProfileStore((state) => state.setMaxDishBudget);
  const setSkippedTasteQuiz = useSessionStore((state) => state.setSkippedTasteQuiz);
  const showToast = useUIStore((state) => state.showToast);
  const flowMode = route.params?.mode ?? "onboarding";
  const isDietaryRoute = route.name === "DietaryPreferences";
  const initialPhase = isDietaryRoute ? "dietary" : (route.params?.initialPhase ?? "taste");
  // A relaunch reopens this step with the answers given so far (a draft under 24 hours old).
  const [draft] = useState(() => (flowMode === "onboarding" ? getFreshOnboardingDraft() : null));
  // The dietary step is a separate route instance, so the taste answers come from the draft the
  // quiz route keeps (route params would put an object in the web URL); without any answered
  // question we must not overwrite the vector.
  const draftAnsweredKeys = draft?.quiz?.answeredKeys ?? [];
  const carriedAnswers =
    isDietaryRoute && hasAnsweredAnyQuestion(draftAnsweredKeys) ? draft?.quiz?.answers : undefined;
  const hasTasteAnswers = !isDietaryRoute || carriedAnswers !== undefined;
  const isOnboardingTaste = flowMode === "onboarding" && !isDietaryRoute;
  const quizLength = useExperimentVariant("onboarding_quiz_length_v1", {
    enabled: isOnboardingTaste,
  });
  const quizLayout = useExperimentVariant("onboarding_quiz_layout_v1", {
    enabled: isOnboardingTaste,
  });
  const questionKeys = isOnboardingTaste && quizLength === "test" ? SHORT_STEPS : STEPS;
  const useTiles = quizLayout === "test";
  const carriedAnsweredKeys = isDietaryRoute ? draftAnsweredKeys : undefined;
  // Answers stay a local draft until the quiz is finished, so swiping does not
  // write, sync or log anything and backing out discards the draft. A retake from
  // Profile starts from the saved vector so untouched dimensions keep their values.
  const [values, setValues] = useState<TasteVector>(
    carriedAnswers ??
      (flowMode === "profile" ? profile.tasteVector : (draft?.quiz?.answers ?? INITIAL)),
  );
  const [dietaryPreferences, setDietaryPreferencesState] = useState<DietaryFlag[]>(
    draft?.dietary?.dietaryPreferences ?? profile.dietaryPreferences,
  );
  const [maxDishBudget, setMaxDishBudgetState] = useState(
    draft?.dietary ? (draft.dietary.maxDishBudget ?? undefined) : profile.maxDishBudget,
  );
  const [step, setStep] = useState(() => Math.min(draft?.quiz?.step ?? 0, questionKeys.length - 1));
  const [phase, setPhase] = useState<"taste" | "dietary">(initialPhase);
  // Questions the user answered (tapped or swiped). A retake starts with the saved vector
  // answered; in onboarding nothing is answered until the user picks a card, so the
  // preselected middle card is never recorded as a "Balanced" answer.
  const [answeredKeys, setAnsweredKeys] = useState<TasteKey[]>(
    flowMode === "profile" ? [...STEPS] : (draft?.quiz?.answeredKeys ?? []),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  // One finish per screen: a double tap on Continue must not save the quiz twice.
  const finishedRef = useRef(false);
  const optionsFadeAnim = useRef(new Animated.Value(1)).current;
  const quizScrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList<number> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  // Keep the answers given so far, so closing the app mid-quiz does not lose them.
  useEffect(() => {
    if (!isOnboardingTaste) return;
    useOnboardingDraftStore.getState().rememberQuiz({ answers: values, answeredKeys, step });
  }, [answeredKeys, isOnboardingTaste, step, values]);
  useEffect(() => {
    if (!(flowMode === "onboarding" && isDietaryRoute)) return;
    useOnboardingDraftStore
      .getState()
      .rememberDietary({ dietaryPreferences, maxDishBudget: maxDishBudget ?? null });
  }, [dietaryPreferences, flowMode, isDietaryRoute, maxDishBudget]);

  // Coming back to this screen (Back from the next step) re-arms Continue.
  useEffect(
    () =>
      navigation.addListener("focus", () => {
        finishedRef.current = false;
      }),
    [navigation],
  );

  // Funnel: the taste step is viewed once per onboarding run (not per question).
  useEffect(() => {
    if (flowMode === "onboarding" && !isDietaryRoute) trackOnboardingStepViewed("taste");
  }, [flowMode, isDietaryRoute]);

  const currentKey = questionKeys[step] ?? questionKeys[0]!;
  const labels = LABELS[currentKey];
  const choiceFoods = TASTE_QUESTION_FOODS[currentKey];
  const totalSteps = questionKeys.length + 1;
  const inDietaryStep = phase === "dietary";
  const { scrollIndex, selectedIndex } = resolveQuestionCard(values, currentKey, answeredKeys);
  const scrollIndexRef = useRef(scrollIndex);
  scrollIndexRef.current = scrollIndex;

  // Funnel: every question (and the dietary step) is a view, so drop-off inside the quiz is visible.
  useEffect(() => {
    if (flowMode !== "onboarding") return;
    if (inDietaryStep) trackOnboardingQuestionViewed("dietary", questionKeys.length);
    else trackOnboardingQuestionViewed(currentKey, step);
  }, [currentKey, flowMode, inDietaryStep, questionKeys.length, step]);

  const CARD_WIDTH = 220;
  // Sized from the screen so short phones keep the question and buttons in view.
  const CARD_HEIGHT = Math.round(Math.min(298, Math.max(200, height * 0.34)));
  const CARD_GAP = spacing[8];
  const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
  const horizontalPadding = Math.max(0, (width - CARD_WIDTH) / 2);
  const snapOffsets = useMemo(() => [0, SNAP_INTERVAL, SNAP_INTERVAL * 2], [SNAP_INTERVAL]);
  const dimOpacities = useMemo(
    () =>
      [0, 1, 2].map((index) =>
        quizScrollX.interpolate({
          inputRange: [
            (index - 1) * SNAP_INTERVAL,
            index * SNAP_INTERVAL,
            (index + 1) * SNAP_INTERVAL,
          ],
          outputRange: [0.45, 0, 0.45],
          extrapolate: "clamp",
        }),
      ),
    [SNAP_INTERVAL, quizScrollX],
  );
  const CardSeparator = useCallback(() => <View style={{ width: CARD_GAP }} />, [CARD_GAP]);
  const accessibilityFooterReserve = Math.ceil(Math.max(fontScale - 1, 0) * 96);
  const actionFooterBottomPadding = ONBOARDING_ACTIONS_BOTTOM_PADDING + spacing[2];

  // The single place the carousel is positioned: the saved answer's card (or the middle one),
  // when the step, the width or the phase changes. The answer itself is read from a ref so a
  // tap, which scrolls on its own, does not scroll twice.
  useEffect(() => {
    if (inDietaryStep) return;
    const frame = requestAnimationFrame(() => {
      const offset = SNAP_INTERVAL * scrollIndexRef.current;
      carouselRef.current?.scrollToOffset({ animated: false, offset });
      quizScrollX.setValue(offset);
    });
    return () => cancelAnimationFrame(frame);
  }, [SNAP_INTERVAL, inDietaryStep, quizScrollX, step, width]);

  // A short crossfade between questions: the options fade out, the next question's fade in.
  const animateStep = (nextStep: number) => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (isTransitioning) {
      return;
    }
    setIsTransitioning(true);
    optionsFadeAnim.setValue(1);
    Animated.timing(optionsFadeAnim, {
      toValue: 0,
      duration: fadeDuration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      stepTimerRef.current = setTimeout(() => {
        Animated.timing(optionsFadeAnim, {
          toValue: 1,
          duration: fadeDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioning(false);
        });
      }, 0);
    });
  };

  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const tasteAnswers = hasTasteAnswers ? values : profile.tasteVector;
    if (hasTasteAnswers) {
      setTasteVector(values);
    }
    // A guest's answers are kept on the device and saved once they sign in.
    recordQuizResponse(
      {
        answers: tasteAnswers,
        // Which answers the user picked; the rest are the untouched middle value.
        answeredKeys: hasTasteAnswers
          ? isDietaryRoute
            ? (carriedAnsweredKeys ?? [])
            : answeredKeys
          : [],
        tasteSkipped: !hasTasteAnswers,
        dietaryPreferences,
        maxDishBudget: maxDishBudget ?? null,
        cuisineIds: profile.onboardingCuisineIds ?? [],
        flowMode,
      },
      tasteAnswers,
    );
    // Settings opens this as a profile edit; its rows tag the events with where they came from.
    const surface =
      (route.params && "source" in route.params ? route.params.source : undefined) ?? flowMode;
    // A profile edit sends a preference event only when the answer changed (a taste-only
    // edit, or Continue without changes, is not a dietary or budget update).
    const dietaryChanged =
      flowMode !== "profile" ||
      dietaryPreferences.length !== profile.dietaryPreferences.length ||
      dietaryPreferences.some((flag) => !profile.dietaryPreferences.includes(flag));
    const budgetChanged =
      flowMode !== "profile" || (maxDishBudget ?? null) !== (profile.maxDishBudget ?? null);
    if (dietaryChanged) setDietaryPreferences(dietaryPreferences, { surface });
    if (budgetChanged) setMaxDishBudget(maxDishBudget, { surface });
    if (flowMode === "profile") {
      setSkippedTasteQuiz(false);
      showToast({ message: "Taste profile updated.", tone: "success" });
      navigation.goBack();
      return;
    }
    // Answering the taste questions means the quiz was not skipped; a Skip still
    // reaches this dietary step and stays marked as skipped. Next: how open they are to new food.
    setSkippedTasteQuiz(!hasTasteAnswers);
    const nextRoute = nextOnboardingRoute("DietaryPreferences");
    if (nextRoute === "FoodOpenness") navigation.navigate("FoodOpenness", { mode: "onboarding" });
    else navigation.navigate(nextRoute);
  };

  const isLast = step === questionKeys.length - 1;

  const toggleDietary = (flag: DietaryFlag) => {
    setDietaryPreferencesState((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag],
    );
  };

  // A tap or a swipe is the answer; nothing else marks a question as answered.
  const answerTaste = (index: number) => {
    const option = OPTIONS[index]!;
    setAnsweredKeys((current) =>
      current.includes(currentKey) ? current : [...current, currentKey],
    );
    if (values[currentKey] !== option) {
      setValues({ ...values, [currentKey]: option });
    }
  };

  const selectTasteOption = (index: number) => {
    carouselRef.current?.scrollToOffset({
      animated: true,
      offset: SNAP_INTERVAL * index,
    });
    answerTaste(index);
  };

  // Tiles: a tap answers, then the next question slides in after a beat. Reduce Motion, a
  // screen reader, a retake from Profile and the last question wait for Next instead.
  const selectTile = (index: number) => {
    answerTaste(index);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (reduceMotion || screenReaderOn || !isOnboardingTaste || isLast) return;
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      animateStep(step + 1);
    }, AUTO_ADVANCE_MS);
  };

  // Header arrow: the previous question, or out of the quiz from the first one.
  const handleHeaderBack = () => {
    if (inDietaryStep && !isDietaryRoute) {
      setPhase("taste");
      return;
    }
    if (!inDietaryStep && step > 0) {
      animateStep(step - 1);
      return;
    }
    navigation.goBack();
  };

  const goToDietary = () => {
    // No answered question means the taste part was skipped, not "everything balanced".
    const answeredAny = hasAnsweredAnyQuestion(answeredKeys);
    if (flowMode === "profile") {
      setPhase("dietary");
      return;
    }
    if (!answeredAny) trackOnboardingStepSkipped("taste");
    // The dietary step reads the answers from the draft, not from route params.
    useOnboardingDraftStore.getState().rememberQuiz({ answers: values, answeredKeys, step });
    navigation.navigate("DietaryPreferences", {
      mode: flowMode,
      initialPhase: "dietary",
    });
  };

  const headingText = inDietaryStep ? "Any dietary needs?" : QUESTIONS[currentKey];
  // Onboarding shows the shared progress bar (the questions fill the Taste segment); a retake
  // from Profile has no steps, so it keeps the plain counter.
  const progressBlock =
    flowMode === "onboarding" ? (
      <View style={{ paddingHorizontal: spacing[3] }}>
        <OnboardingProgress
          step="taste"
          subProgress={inDietaryStep ? 1 : (step + 1) / totalSteps}
          detail={inDietaryStep ? undefined : `Question ${step + 1} of ${totalSteps}`}
        />
      </View>
    ) : (
      <AppText
        variant="bodySmall"
        tone="muted"
        style={{ paddingHorizontal: spacing[3], textAlign: "center" }}
      >
        {inDietaryStep
          ? `Question ${totalSteps} of ${totalSteps}`
          : `Question ${step + 1} of ${totalSteps}`}
      </AppText>
    );
  const headingBlock = (
    <View style={{ gap: spacing[2], paddingHorizontal: spacing[3] }}>
      {/* One heading per screen: the question itself. */}
      <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
        {headingText}
      </AppText>
      {inDietaryStep ? null : (
        // Always on screen, so the options do not jump when the first answer arrives.
        <AppText variant="micro" tone="muted" style={{ minHeight: 18, textAlign: "center" }}>
          {selectedIndex < 0
            ? "Tap one to answer, or go Next to leave this one out."
            : `Picked: ${labels[selectedIndex]}`}
        </AppText>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bg, flex: 1, overflow: "hidden" }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1, overflow: "hidden", paddingTop: spacing[3] }}>
        <View style={{ alignItems: "center", flexDirection: "row", paddingHorizontal: spacing[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleHeaderBack}
            style={{
              alignItems: "center",
              borderRadius: radii.pill,
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <ArrowLeft color={palette.text} size={22} />
          </Pressable>
        </View>
        {inDietaryStep ? (
          // One scroll for the whole step: at large text sizes the heading and the chips
          // scroll together, so the budget below them is never out of reach.
          <ScrollView
            testID="dietary-step-scroll"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: spacing[3],
              paddingBottom: spacing[6] + accessibilityFooterReserve,
              paddingTop: spacing[2],
            }}
          >
            {progressBlock}
            {headingBlock}
            <DietaryStep
              selected={dietaryPreferences}
              onToggle={toggleDietary}
              onClear={() => setDietaryPreferencesState([])}
              budget={maxDishBudget}
              onBudgetChange={setMaxDishBudgetState}
              showBudget={!FEATURE_FLAGS.sliderOnboardingEnabled}
            />
          </ScrollView>
        ) : (
          // The taste phase scrolls, so large text sizes cannot push the options or the footer buttons out of reach.
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, gap: spacing[3], paddingTop: spacing[2] }}
          >
            {progressBlock}
            {headingBlock}
            <Animated.View
              accessibilityRole={useTiles ? undefined : "radiogroup"}
              accessibilityLabel={useTiles ? undefined : QUESTIONS[currentKey]}
              style={{
                flex: 1,
                justifyContent: "center",
                overflow: "visible",
                // The rows fill the height themselves; the carousel needs the room around it.
                paddingBottom: spacing[useTiles ? 2 : OPTIONS_VERTICAL_GAP_UNITS],
                paddingTop: spacing[useTiles ? 2 : OPTIONS_VERTICAL_GAP_UNITS],
                opacity: optionsFadeAnim,
              }}
            >
              {useTiles ? (
                <TasteOptionTiles
                  question={QUESTIONS[currentKey]}
                  labels={labels}
                  foods={choiceFoods}
                  selectedIndex={selectedIndex}
                  disabled={isTransitioning}
                  onSelect={selectTile}
                />
              ) : (
                <Animated.FlatList
                  ref={carouselRef}
                  horizontal
                  data={[0, 1, 2]}
                  keyExtractor={(item: number) => `${item}`}
                  showsHorizontalScrollIndicator={false}
                  snapToAlignment="center"
                  snapToOffsets={snapOffsets}
                  decelerationRate="fast"
                  disableIntervalMomentum
                  bounces={false}
                  overScrollMode="never"
                  initialNumToRender={3}
                  maxToRenderPerBatch={3}
                  windowSize={3}
                  removeClippedSubviews={false}
                  scrollEventThrottle={16}
                  style={{ overflow: "visible", width: "100%" }}
                  contentContainerStyle={{
                    paddingHorizontal: horizontalPadding + spacing[2],
                    paddingTop: spacing[2],
                  }}
                  ItemSeparatorComponent={CardSeparator}
                  getItemLayout={(_: ArrayLike<number> | null | undefined, index: number) => ({
                    index,
                    length: SNAP_INTERVAL,
                    offset: SNAP_INTERVAL * index,
                  })}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: quizScrollX } } }],
                    { useNativeDriver: true },
                  )}
                  onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const index = Math.max(
                      0,
                      Math.min(2, Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL)),
                    );
                    const exactOffset = index * SNAP_INTERVAL;
                    if (Math.abs(event.nativeEvent.contentOffset.x - exactOffset) > 0.5) {
                      carouselRef.current?.scrollToOffset({
                        animated: false,
                        offset: exactOffset,
                      });
                    }
                    // A swipe only moves the cards to look at them; a tap is the answer.
                  }}
                  renderItem={({ item: index }: ListRenderItemInfo<number>) => {
                    const isSelected = selectedIndex === index;
                    const dimOpacity = dimOpacities[index];
                    return (
                      <Pressable
                        onPress={() => selectTasteOption(index)}
                        accessibilityRole="radio"
                        accessibilityLabel={`${QUESTIONS[currentKey]} ${labels[index]}`}
                        accessibilityHint={`For example, ${choiceFoods[index].label}`}
                        accessibilityState={{ checked: isSelected, disabled: isTransitioning }}
                        aria-checked={isSelected}
                        disabled={isTransitioning}
                        style={{ alignItems: "center", width: CARD_WIDTH }}
                      >
                        <View
                          style={{
                            backgroundColor: palette.bg,
                            borderColor: isSelected ? palette.orange : "transparent",
                            borderRadius: radii.pill,
                            borderWidth: 3,
                            height: CARD_HEIGHT,
                            justifyContent: "center",
                            overflow: "hidden",
                            width: CARD_WIDTH,
                          }}
                        >
                          {choiceFoods[index].imageSource ? (
                            <AccessibleImage
                              source={choiceFoods[index].imageSource}
                              contentFit="cover"
                              contentPosition="center"
                              style={{ height: "100%", width: "100%" }}
                              decorative
                            />
                          ) : (
                            <NoDishPhoto
                              dishName={choiceFoods[index].label}
                              style={{ height: "100%", width: "100%" }}
                            />
                          )}
                          <Animated.View
                            pointerEvents="none"
                            style={{
                              backgroundColor: palette.bg,
                              bottom: 0,
                              left: 0,
                              position: "absolute",
                              right: 0,
                              top: 0,
                              opacity: dimOpacity,
                            }}
                          />
                          {isSelected ? (
                            <View
                              style={{
                                alignItems: "center",
                                backgroundColor: palette.orange,
                                borderRadius: radii.pill,
                                height: 28,
                                justifyContent: "center",
                                position: "absolute",
                                right: spacing[4],
                                top: spacing[4],
                                width: 28,
                              }}
                            >
                              <Check color={palette.surface} size={16} />
                            </View>
                          ) : null}
                        </View>
                        <AppText
                          variant={isSelected ? "h3" : "body"}
                          tone={isSelected ? "default" : "secondary"}
                          style={{
                            fontWeight: "700",
                            marginTop: spacing[2],
                            textAlign: "center",
                            width: "100%",
                          }}
                        >
                          {labels[index]}
                        </AppText>
                        <AppText
                          variant="micro"
                          tone="secondary"
                          numberOfLines={1}
                          style={{ marginTop: spacing[1], textAlign: "center", width: "100%" }}
                        >
                          {choiceFoods[index].label}
                        </AppText>
                      </Pressable>
                    );
                  }}
                />
              )}
            </Animated.View>
          </ScrollView>
        )}

        <View
          style={{
            flexShrink: 0,
            gap: ONBOARDING_ACTIONS_GAP,
            paddingBottom: actionFooterBottomPadding,
            paddingHorizontal: ONBOARDING_ACTIONS_HORIZONTAL_PADDING,
            paddingTop: spacing[2],
          }}
        >
          {inDietaryStep ? (
            <Button
              label="Continue"
              onPress={handleFinish}
              labelNumberOfLines={fontScale > 1.15 ? 2 : 1}
              labelEllipsizeMode="tail"
            />
          ) : isLast ? (
            <Button label="Next" onPress={goToDietary} />
          ) : (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing[3],
                justifyContent: "center",
              }}
            >
              {step === 0 ? (
                <Button
                  label={flowMode === "profile" ? "Cancel" : "Skip"}
                  variant="ghost"
                  onPress={() => {
                    if (flowMode === "profile") {
                      navigation.goBack();
                      return;
                    }
                    // The taste questions are optional, but dietary needs still
                    // matter: Skip goes to the dietary step without taste answers.
                    trackOnboardingStepSkipped("taste");
                    setSkippedTasteQuiz(true);
                    useOnboardingDraftStore
                      .getState()
                      .rememberQuiz({ answers: values, answeredKeys: [], step });
                    navigation.navigate("DietaryPreferences", {
                      mode: flowMode,
                      initialPhase: "dietary",
                    });
                  }}
                  style={{ width: BACK_BUTTON_WIDTH }}
                />
              ) : null}
              <Button
                label="Next"
                onPress={() => animateStep(step + 1)}
                variant="primary"
                style={step === 0 ? { width: PRIMARY_BUTTON_WIDTH } : { flex: 1 }}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  whiteGlow: {
    shadowOpacity: 0.95,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
