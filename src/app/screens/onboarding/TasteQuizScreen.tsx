import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
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
import { ArrowLeft, Check, Search } from "lucide-react-native";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, Button, AppText, Card, Chip, EmptyState, Input } from "@/components/ui";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import { recordQuizResponse } from "@/features/profile/pendingQuizResponse";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, TasteKey, TasteVector } from "@/types/domain";
import {
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

const DIETARY_OPTIONS: {
  value: DietaryFlag;
  label: string;
  keywords: string[];
}[] = [
  { value: "vegetarian", label: "Vegetarian", keywords: ["veg"] },
  { value: "vegan", label: "Vegan", keywords: ["plant"] },
  { value: "halal", label: "Halal", keywords: ["muslim", "halal"] },
  { value: "gluten_free", label: "Gluten Free", keywords: ["gluten", "wheat"] },
  { value: "dairy_free", label: "Dairy Free", keywords: ["milk", "lactose"] },
  { value: "egg_free", label: "Egg Free", keywords: ["egg"] },
  {
    value: "nut_free",
    label: "Nut Free",
    keywords: ["nut", "peanut", "almond"],
  },
  { value: "peanut_free", label: "Peanut Free", keywords: ["peanut"] },
  {
    value: "shellfish_free",
    label: "Shellfish Free",
    keywords: ["shrimp", "prawn", "shellfish"],
  },
  { value: "soy_free", label: "Soy Free", keywords: ["soy", "tofu"] },
  { value: "sesame_free", label: "Sesame Free", keywords: ["sesame"] },
  { value: "pork_free", label: "Pork Free", keywords: ["pork"] },
  { value: "pescatarian", label: "Pescatarian", keywords: ["fish"] },
  { value: "kosher", label: "Kosher", keywords: ["jewish", "kosher"] },
  { value: "keto", label: "Keto", keywords: ["keto", "ketogenic"] },
  { value: "paleo", label: "Paleo", keywords: ["paleo"] },
  { value: "low_carb", label: "Low Carb", keywords: ["carb"] },
  { value: "low_sodium", label: "Low Sodium", keywords: ["salt", "sodium"] },
  { value: "low_sugar", label: "Low Sugar", keywords: ["sugar"] },
  {
    value: "diabetic_friendly",
    label: "Diabetic Friendly",
    keywords: ["diabetic", "diabetes", "glycemic"],
  },
  {
    value: "fodmap_friendly",
    label: "FODMAP Friendly",
    keywords: ["fodmap", "ibs"],
  },
  { value: "beef_free", label: "Beef Free", keywords: ["beef"] },
  {
    value: "allium_free",
    label: "Allium Free",
    keywords: ["onion", "garlic", "allium"],
  },
  { value: "fish_free", label: "Fish Free", keywords: ["fish"] },
  {
    value: "mollusc_free",
    label: "Mollusc Free",
    keywords: ["mollusc", "clam", "oyster", "mussel"],
  },
  { value: "celery_free", label: "Celery Free", keywords: ["celery"] },
  { value: "mustard_free", label: "Mustard Free", keywords: ["mustard"] },
  { value: "lupin_free", label: "Lupin Free", keywords: ["lupin"] },
  {
    value: "sulphite_free",
    label: "Sulphite Free",
    keywords: ["sulphite", "sulfite"],
  },
];

// The diets most Singapore diners look for come first; the rest sit behind "Show all".
const POPULAR_DIETARY_FLAGS: DietaryFlag[] = [
  "halal",
  "vegetarian",
  "vegan",
  "pork_free",
  "beef_free",
  "nut_free",
  "shellfish_free",
  "gluten_free",
  "dairy_free",
];

const BUDGET_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "Under S$6", value: 6 },
  { label: "Under S$12", value: 12 },
  { label: "Any price", value: undefined },
];

export function TasteQuizScreen({ navigation, route }: Props) {
  const { componentRadii, motion, palette, radii, spacing } = useHungryTheme();
  const { fontScale, height, width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const stepDuration = reduceMotion ? 0 : motion.onboardingStep;
  const setTasteVector = useProfileStore((state) => state.setTasteVector);
  const profile = useProfileStore((state) => state.profile);
  const setDietaryPreferences = useProfileStore((state) => state.setDietaryPreferences);
  const setMaxDishBudget = useProfileStore((state) => state.setMaxDishBudget);
  const setSkippedTasteQuiz = useSessionStore((state) => state.setSkippedTasteQuiz);
  const showToast = useUIStore((state) => state.showToast);
  const flowMode = route.params?.mode ?? "onboarding";
  const isDietaryRoute = route.name === "DietaryPreferences";
  const initialPhase = isDietaryRoute ? "dietary" : (route.params?.initialPhase ?? "taste");
  // The dietary step is a separate route instance, so the taste answers from the
  // quiz route arrive via params; without them we must not overwrite the vector.
  const carriedAnswers =
    isDietaryRoute && route.params && "answers" in route.params ? route.params.answers : undefined;
  const hasTasteAnswers = !isDietaryRoute || carriedAnswers !== undefined;
  const carriedAnsweredKeys =
    isDietaryRoute && route.params && "answeredKeys" in route.params
      ? route.params.answeredKeys
      : undefined;
  // Answers stay a local draft until the quiz is finished, so swiping does not
  // write, sync or log anything and backing out discards the draft. A retake from
  // Profile starts from the saved vector so untouched dimensions keep their values.
  const [values, setValues] = useState<TasteVector>(
    carriedAnswers ?? (flowMode === "profile" ? profile.tasteVector : INITIAL),
  );
  const [dietaryPreferences, setDietaryPreferencesState] = useState<DietaryFlag[]>(
    profile.dietaryPreferences,
  );
  const [maxDishBudget, setMaxDishBudgetState] = useState(profile.maxDishBudget);
  const [dietaryQuery, setDietaryQuery] = useState("");
  const [showAllDietary, setShowAllDietary] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"taste" | "dietary">(initialPhase);
  // Questions the user answered (tapped or swiped). A retake starts with the saved vector
  // answered; in onboarding nothing is answered until the user picks a card, so the
  // preselected middle card is never recorded as a "Balanced" answer.
  const [answeredKeys, setAnsweredKeys] = useState<TasteKey[]>(
    flowMode === "profile" ? [...STEPS] : [],
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  // One finish per screen: a double tap on Continue must not save the quiz twice.
  const finishedRef = useRef(false);
  const optionsSlideAnim = useRef(new Animated.Value(0)).current;
  const quizScrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList<number> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    },
    [],
  );

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

  const currentKey = STEPS[step];
  const labels = LABELS[currentKey];
  const choiceFoods = TASTE_QUESTION_FOODS[currentKey];
  const totalSteps = STEPS.length + 1;
  const inDietaryStep = phase === "dietary";
  const { scrollIndex, selectedIndex } = resolveQuestionCard(values, currentKey, answeredKeys);
  const scrollIndexRef = useRef(scrollIndex);
  scrollIndexRef.current = scrollIndex;

  // Funnel: every question (and the dietary step) is a view, so drop-off inside the quiz is visible.
  useEffect(() => {
    if (flowMode !== "onboarding") return;
    if (inDietaryStep) trackOnboardingQuestionViewed("dietary", STEPS.length);
    else trackOnboardingQuestionViewed(currentKey, step);
  }, [currentKey, flowMode, inDietaryStep, step]);

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

  const animateStep = (nextStep: number, direction: "forward" | "backward") => {
    if (isTransitioning) {
      return;
    }
    const offscreenDistance = width + CARD_WIDTH + CARD_GAP;
    const exitTo = direction === "forward" ? -offscreenDistance : offscreenDistance;
    const enterFrom = direction === "forward" ? offscreenDistance : -offscreenDistance;
    setIsTransitioning(true);
    optionsSlideAnim.setValue(0);
    Animated.timing(optionsSlideAnim, {
      toValue: exitTo,
      duration: stepDuration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      optionsSlideAnim.setValue(enterFrom);
      stepTimerRef.current = setTimeout(() => {
        Animated.timing(optionsSlideAnim, {
          toValue: 0,
          duration: stepDuration,
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
    setDietaryPreferences(dietaryPreferences);
    setMaxDishBudget(maxDishBudget);
    if (flowMode === "profile") {
      setSkippedTasteQuiz(false);
      showToast({ message: "Taste profile updated.", tone: "success" });
      navigation.goBack();
      return;
    }
    // Answering the taste questions means the quiz was not skipped; a Skip still
    // reaches this dietary step and stays marked as skipped. Next: how open they are to new food.
    setSkippedTasteQuiz(!hasTasteAnswers);
    navigation.navigate("FoodOpenness", { mode: "onboarding" });
  };

  const isLast = step === STEPS.length - 1;
  const normalizedDietaryQuery = dietaryQuery.trim().toLowerCase();
  const sortedDietaryOptions = [
    ...POPULAR_DIETARY_FLAGS.map(
      (flag) => DIETARY_OPTIONS.find((option) => option.value === flag)!,
    ),
    ...DIETARY_OPTIONS.filter((option) => !POPULAR_DIETARY_FLAGS.includes(option.value)),
  ];
  const filteredDietaryOptions = sortedDietaryOptions.filter((option) => {
    if (!normalizedDietaryQuery) {
      return (
        showAllDietary ||
        POPULAR_DIETARY_FLAGS.includes(option.value) ||
        dietaryPreferences.includes(option.value)
      );
    }
    const haystack = `${option.label} ${option.keywords.join(" ")}`.toLowerCase();
    return haystack.includes(normalizedDietaryQuery);
  });
  const hiddenDietaryCount = normalizedDietaryQuery
    ? 0
    : sortedDietaryOptions.length - filteredDietaryOptions.length;

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

  // Header arrow: the previous question, or out of the quiz from the first one.
  const handleHeaderBack = () => {
    if (inDietaryStep && !isDietaryRoute) {
      setPhase("taste");
      return;
    }
    if (!inDietaryStep && step > 0) {
      animateStep(step - 1, "backward");
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
    navigation.navigate("DietaryPreferences", {
      mode: flowMode,
      initialPhase: "dietary",
      ...(answeredAny ? { answers: values, answeredKeys } : {}),
    });
  };

  const renderDietaryRow = ({
    key,
    label,
    isSelected,
    onPress,
    hint,
  }: {
    key: string;
    label: string;
    isSelected: boolean;
    onPress: () => void;
    hint: string;
  }) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`Dietary preference ${label}`}
      accessibilityHint={hint}
      accessibilityState={{ checked: isSelected }}
      style={{
        alignItems: "center",
        backgroundColor: isSelected ? palette.orangeLight : palette.surface,
        borderColor: isSelected ? palette.orange : palette.border,
        borderRadius: componentRadii.button,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 52,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: isSelected ? palette.orange : "transparent",
          borderColor: isSelected ? palette.orange : palette.border,
          borderRadius: radii.pill,
          borderWidth: 1,
          height: 20,
          justifyContent: "center",
          width: 20,
        }}
      >
        {isSelected ? <Check color={palette.surface} size={12} /> : null}
      </View>
      <AppText style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );

  const headline = inDietaryStep ? (
    <AppText variant="h1" accessibilityRole="header" style={{ textAlign: "center" }}>
      Any dietary needs?
    </AppText>
  ) : (
    <AppText variant="h1" accessibilityRole="header" style={{ textAlign: "center" }}>
      What flavours do{"\n"}you{" "}
      <AppText variant="h1" style={{ color: palette.orange }}>
        enjoy
      </AppText>
      ?
    </AppText>
  );
  // The question counter is the only counter on these screens; the step bar returns on the next step.
  const questionHeading = (
    <View style={{ gap: spacing[3] }}>
      {/* The dietary step's h1 is its question; a second heading would only repeat it. */}
      {inDietaryStep ? null : (
        <AppText variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
          {QUESTIONS[currentKey]}
        </AppText>
      )}
      <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
        Question {inDietaryStep ? totalSteps : step + 1} of {totalSteps}
      </AppText>
      {!inDietaryStep && selectedIndex < 0 ? (
        <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
          Tap or swipe to answer, or go Next to leave this one out.
        </AppText>
      ) : null}
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
          // One scroll for the whole step: at large text sizes the headings and the search
          // must scroll away with the list, or the list (and the budget) get no room at all.
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
            {headline}
            {questionHeading}
            <View style={{ paddingHorizontal: spacing[3] }}>
              <Card style={{ gap: spacing[2], padding: spacing[3] }}>
                <AppText variant="bodySmall" tone="muted">
                  Select any that apply. We use these to filter dishes. Allergen details come from
                  stalls and diners and may be incomplete, so always check with the stall.
                </AppText>
                <Input
                  placeholder="Search dietary restrictions"
                  value={dietaryQuery}
                  onChangeText={setDietaryQuery}
                  leftIcon={<Search color={palette.textMuted} size={16} />}
                />
                <View style={{ gap: spacing[2], paddingTop: spacing[1] }}>
                  {normalizedDietaryQuery
                    ? null
                    : renderDietaryRow({
                        key: "none",
                        label: "None",
                        isSelected: dietaryPreferences.length === 0,
                        onPress: () => setDietaryPreferencesState([]),
                        hint: "Double tap to clear your dietary preferences",
                      })}
                  {filteredDietaryOptions.map((option) => {
                    const isSelected = dietaryPreferences.includes(option.value);
                    return renderDietaryRow({
                      key: option.value,
                      label: option.label,
                      isSelected,
                      onPress: () => toggleDietary(option.value),
                      hint: isSelected
                        ? "Double tap to remove this dietary preference"
                        : "Double tap to add this dietary preference",
                    });
                  })}
                  {!filteredDietaryOptions.length ? (
                    <EmptyState
                      title="No match"
                      body="Try another word, like halal, vegetarian or nuts."
                    />
                  ) : null}
                  {hiddenDietaryCount > 0 ? (
                    <Button
                      label={`Show all (${hiddenDietaryCount} more)`}
                      variant="ghost"
                      onPress={() => setShowAllDietary(true)}
                    />
                  ) : null}
                  <AppText variant="h3" style={{ marginTop: spacing[2] }}>
                    Usual budget per dish
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                    {BUDGET_OPTIONS.map((option) => (
                      <Chip
                        key={option.label}
                        label={option.label}
                        accessibilityLabel={`Budget ${option.label}`}
                        selected={maxDishBudget === option.value}
                        onPress={() => setMaxDishBudgetState(option.value)}
                      />
                    ))}
                  </View>
                </View>
              </Card>
            </View>
          </ScrollView>
        ) : (
          // The taste phase scrolls, so large text sizes cannot push the cards or the footer buttons out of reach.
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, gap: spacing[3], paddingTop: spacing[2] }}
          >
            {headline}
            {questionHeading}
            <Animated.View
              accessibilityRole="radiogroup"
              accessibilityLabel={QUESTIONS[currentKey]}
              style={{
                flex: 1,
                justifyContent: "center",
                overflow: "visible",
                paddingBottom: spacing[OPTIONS_VERTICAL_GAP_UNITS],
                paddingTop: spacing[OPTIONS_VERTICAL_GAP_UNITS],
                transform: [{ translateX: optionsSlideAnim }],
              }}
            >
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
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: quizScrollX } } }], {
                  useNativeDriver: true,
                })}
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
                  // The card the carousel was placed on is not an answer; only a swipe to another card is.
                  if (index === scrollIndexRef.current) return;
                  answerTaste(index);
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
                      disabled={isTransitioning}
                      style={{ alignItems: "center", width: CARD_WIDTH }}
                    >
                      <View
                        style={[
                          isSelected
                            ? {
                                ...styles.whiteGlow,
                                shadowColor: palette.surface,
                              }
                            : null,
                          {
                            backgroundColor: palette.bg,
                            borderRadius: radii.pill,
                            height: CARD_HEIGHT,
                            justifyContent: "center",
                            overflow: "hidden",
                            width: CARD_WIDTH,
                          },
                        ]}
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
            <View style={{ gap: ONBOARDING_ACTIONS_GAP }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  justifyContent: "center",
                }}
              >
                <Button
                  label="Back"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    if (isDietaryRoute) {
                      navigation.goBack();
                      return;
                    }
                    setPhase("taste");
                  }}
                  style={{
                    flex: 1,
                    minWidth: 86,
                  }}
                />
                <Button
                  label="Continue"
                  onPress={handleFinish}
                  fullWidth={false}
                  style={{
                    flex: 2,
                    minWidth: 160,
                  }}
                  labelNumberOfLines={fontScale > 1.15 ? 2 : 1}
                  labelEllipsizeMode="tail"
                />
              </View>
            </View>
          ) : isLast ? (
            <View style={{ gap: ONBOARDING_ACTIONS_GAP }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  justifyContent: "center",
                }}
              >
                <Button
                  label="Back"
                  variant="secondary"
                  onPress={() => animateStep(step - 1, "backward")}
                  style={{ width: BACK_BUTTON_WIDTH }}
                />
                <Button
                  label="Next"
                  onPress={goToDietary}
                  style={{ width: PRIMARY_BUTTON_WIDTH }}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: ONBOARDING_ACTIONS_GAP }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  justifyContent: "center",
                }}
              >
                {step > 0 ? (
                  <Button
                    label="Back"
                    variant="secondary"
                    onPress={() => animateStep(step - 1, "backward")}
                    style={{ width: BACK_BUTTON_WIDTH }}
                  />
                ) : (
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
                      navigation.navigate("DietaryPreferences", {
                        mode: flowMode,
                        initialPhase: "dietary",
                      });
                    }}
                    style={{ width: BACK_BUTTON_WIDTH }}
                  />
                )}
                <Button
                  label="Next"
                  onPress={() => animateStep(step + 1, "forward")}
                  variant="primary"
                  style={{ width: PRIMARY_BUTTON_WIDTH }}
                />
              </View>
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
