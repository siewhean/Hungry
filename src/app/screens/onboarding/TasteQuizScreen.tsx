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
import { Check, ChevronRight, Search } from "lucide-react-native";

import { AccessibleImage, Button, AppText, Card, Chip, EmptyState, Input } from "@/components/ui";
import { NEUTRAL_TASTE_VECTOR, TASTE_DIMENSIONS } from "@/constants/taste";
import { recordQuizResponse } from "@/features/profile/pendingQuizResponse";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, TasteVector } from "@/types/domain";
import {
  OnboardingProgress,
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

const OPTIONS = [2, 5, 8] as const;
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
  { label: "Under $6", value: 6 },
  { label: "Under $12", value: 12 },
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
  const [snappedIndex, setSnappedIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
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

  // Funnel: the taste step is viewed once per onboarding run (not per question).
  useEffect(() => {
    if (flowMode === "onboarding" && !isDietaryRoute) trackOnboardingStepViewed("taste");
  }, [flowMode, isDietaryRoute]);

  const currentKey = STEPS[step];
  const labels = LABELS[currentKey];
  const choiceFoods = TASTE_QUESTION_FOODS[currentKey];
  const totalSteps = STEPS.length + 1;

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

  useEffect(() => {
    const offset = SNAP_INTERVAL;
    requestAnimationFrame(() => {
      carouselRef.current?.scrollToOffset({ animated: false, offset });
      quizScrollX.setValue(offset);
    });
    const id = setTimeout(() => {
      carouselRef.current?.scrollToOffset({ animated: false, offset });
      quizScrollX.setValue(offset);
    }, 60);
    return () => clearTimeout(id);
  }, [SNAP_INTERVAL, step, width, quizScrollX]);

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
      setSnappedIndex(1);
      optionsSlideAnim.setValue(enterFrom);
      stepTimerRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          carouselRef.current?.scrollToOffset({
            animated: false,
            offset: SNAP_INTERVAL,
          });
        });
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
    const tasteAnswers = hasTasteAnswers ? values : profile.tasteVector;
    if (hasTasteAnswers) {
      setTasteVector(values);
    }
    // A guest's answers are kept on the device and saved once they sign in.
    recordQuizResponse(
      {
        answers: tasteAnswers,
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
  const inDietaryStep = phase === "dietary";
  const currentValue = values[currentKey];
  const hasRestrictions = dietaryPreferences.length > 0;
  const dietaryPrimaryLabel = hasRestrictions ? "Continue" : "No restrictions";
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

  const selectTasteOption = (index: number) => {
    const option = OPTIONS[index];
    setSnappedIndex(index);
    carouselRef.current?.scrollToOffset({
      animated: true,
      offset: SNAP_INTERVAL * index,
    });
    if (values[currentKey] !== option) {
      setValues({ ...values, [currentKey]: option });
    }
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bg, flex: 1, overflow: "hidden" }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1, overflow: "hidden", paddingTop: spacing[3] }}>
        {flowMode === "onboarding" ? (
          <View style={{ paddingHorizontal: spacing[3] }}>
            <OnboardingProgress step="taste" />
          </View>
        ) : null}
        <View style={{ gap: spacing[2], paddingTop: spacing[2] }}>
          {inDietaryStep ? (
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
          )}
        </View>

        <View style={{ flex: 1, gap: spacing[3], paddingTop: spacing[3] }}>
          <AppText variant="h2" style={{ textAlign: "center" }}>
            {inDietaryStep ? "Dietary preferences" : QUESTIONS[currentKey]}
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
            Question {inDietaryStep ? totalSteps : step + 1} of {totalSteps}
          </AppText>

          {inDietaryStep ? (
            <View
              style={{
                flex: 1,
                paddingBottom: spacing[4],
                paddingHorizontal: spacing[3],
              }}
            >
              <Card style={{ flex: 1, gap: spacing[2], padding: spacing[3] }}>
                <AppText variant="h3">Select any that apply</AppText>
                <AppText variant="bodySmall" tone="muted">
                  We use these to filter dishes. Allergen details come from stalls and diners and
                  may be incomplete, so always check with the stall.
                </AppText>
                <Input
                  placeholder="Search dietary restrictions"
                  value={dietaryQuery}
                  onChangeText={setDietaryQuery}
                  leftIcon={<Search color={palette.textMuted} size={16} />}
                />
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: spacing[2],
                    paddingBottom: spacing[6] + accessibilityFooterReserve,
                    paddingTop: spacing[1],
                  }}
                >
                  {filteredDietaryOptions.map((option) => {
                    const isSelected = dietaryPreferences.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleDietary(option.value)}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Dietary preference ${option.label}`}
                        accessibilityHint={
                          isSelected
                            ? "Double tap to remove this dietary preference"
                            : "Double tap to add this dietary preference"
                        }
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
                        <AppText style={{ flex: 1 }}>{option.label}</AppText>
                      </Pressable>
                    );
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
                </ScrollView>
              </Card>
            </View>
          ) : (
            <Animated.View
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
                onLayout={() => {
                  requestAnimationFrame(() => {
                    carouselRef.current?.scrollToOffset({
                      animated: false,
                      offset: SNAP_INTERVAL,
                    });
                    quizScrollX.setValue(SNAP_INTERVAL);
                  });
                }}
                onScrollToIndexFailed={() => {
                  requestAnimationFrame(() => {
                    carouselRef.current?.scrollToOffset({
                      animated: false,
                      offset: SNAP_INTERVAL,
                    });
                    quizScrollX.setValue(SNAP_INTERVAL);
                  });
                }}
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
                  const option = OPTIONS[index];
                  setSnappedIndex(index);
                  if (values[currentKey] !== option) {
                    setValues({ ...values, [currentKey]: option });
                  }
                }}
                renderItem={({ item: index }: ListRenderItemInfo<number>) => {
                  const isSelected = snappedIndex === index;
                  const dimOpacity = dimOpacities[index];
                  return (
                    <Pressable
                      onPress={() => selectTasteOption(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`${QUESTIONS[currentKey]} ${labels[index]}`}
                      accessibilityHint={`For example, ${choiceFoods[index].label}`}
                      accessibilityState={{ selected: isSelected, disabled: isTransitioning }}
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
                        <AccessibleImage
                          source={choiceFoods[index].imageSource}
                          contentFit="cover"
                          contentPosition="center"
                          style={{ height: "100%", width: "100%" }}
                          decorative
                        />
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
          )}
        </View>

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
                  label={dietaryPrimaryLabel}
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
                  onPress={() => {
                    if (flowMode === "profile") {
                      setPhase("dietary");
                      return;
                    }
                    navigation.navigate("DietaryPreferences", {
                      mode: flowMode,
                      initialPhase: "dietary",
                      answers: values,
                    });
                  }}
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
                    label="Skip"
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
