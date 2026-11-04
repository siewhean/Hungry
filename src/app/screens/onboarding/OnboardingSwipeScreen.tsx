import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Pressable, View } from "react-native";
import { Heart, X } from "lucide-react-native";

import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { AppText, Button, Card } from "@/components/ui";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { dishFitChips } from "@/features/onboarding/dishFit";
import { nextOnboardingRoute } from "@/features/onboarding/flowRoutes";
import { swipeDishes } from "@/features/onboarding/onboardingDeck";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { confirmHaptic, selectHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ResultDishPhoto } from "./ResultDishCard";
import { loadOnboardingDishPool } from "./tastePicks";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingSwipe">;
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; deck: DishDetail[] };

/** Pull past this many pixels and letting go counts as a choice. */
const SWIPE_DISTANCE = 100;
const FLY_OFF_DISTANCE = 420;
const FLY_OFF_MS = 180;

/** Screen 18: five dishes, heart or pass. Right is a like, left is a pass; buttons do the same. */
export function OnboardingSwipeScreen({ navigation }: Props) {
  useOnboardingScreenViewed("swipe");
  const { palette, radii, spacing } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const tasteVector = useProfileStore((state) => state.profile.tasteVector);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadOnboardingDishPool()
      .then((pool) => {
        if (!active) return;
        // The deck is fixed when it loads, so a like does not reshuffle the cards still to come.
        const liked = useOnboardingAnswersStore.getState().likedDishIds;
        setState({ status: "ready", deck: swipeDishes(pool, liked) });
        setIndex(0);
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "OnboardingSwipe", action: "load_dishes" });
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const deck = state.status === "ready" ? state.deck : [];
  const dish = deck[index];
  const next = () => navigation.navigate(nextOnboardingRoute("OnboardingSwipe", true));

  const decide = (liked: boolean) => {
    if (!dish || busyRef.current) return;
    busyRef.current = true;
    if (liked) confirmHaptic();
    else selectHaptic();
    useOnboardingAnswersStore.getState().recordSwipe(dish.id, liked);
    const finish = () => {
      x.setValue(0);
      busyRef.current = false;
      if (index + 1 >= deck.length) next();
      else setIndex(index + 1);
    };
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.timing(x, {
      toValue: liked ? FLY_OFF_DISTANCE : -FLY_OFF_DISTANCE,
      duration: FLY_OFF_MS,
      useNativeDriver: false,
    }).start(finish);
  };

  // The pan handlers are created once, so they call the latest decide through a ref.
  const decideRef = useRef(decide);
  decideRef.current = decide;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > SWIPE_DISTANCE) decideRef.current(true);
          else if (gesture.dx < -SWIPE_DISTANCE) decideRef.current(false);
          else Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [x],
  );

  const chips = dish ? dishFitChips(dish.tasteVector, tasteVector) : [];
  const priceLabel = dish ? formatDishPrice(dish) : "";
  const rotate = x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <OnboardingFrame
      screen="swipe"
      onBack={() => navigation.goBack()}
      footer={<Button label="Skip for now" variant="ghost" onPress={next} />}
    >
      <MascotLine
        small
        pose="thinking"
        lineId="swipe"
        text="Would you eat this? Swipe right for yes, left for no."
      />

      {state.status === "loading" ? (
        <View
          accessible
          accessibilityLabel="Loading dishes for you"
          style={{ alignItems: "center", padding: spacing[6] }}
        >
          <ActivityIndicator color={palette.orange} />
        </View>
      ) : null}
      {state.status === "error" ? (
        <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            {"We couldn't load dishes right now. You can skip this and still get picks later."}
          </AppText>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => setAttempt((count) => count + 1)}
          />
        </View>
      ) : null}
      {state.status === "ready" && !dish ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            No more dishes to rate yet. More appear on Home as stalls add them.
          </AppText>
          <Button label="Continue" onPress={next} />
        </View>
      ) : null}

      {dish ? (
        <>
          <AppText variant="micro" tone="secondary" accessibilityLiveRegion="polite">
            {`Dish ${index + 1} of ${deck.length}`}
          </AppText>
          <Animated.View
            {...pan.panHandlers}
            style={{ transform: [{ translateX: x }, { rotate }] }}
          >
            <Card style={{ borderRadius: radii.lg, overflow: "hidden", padding: 0 }}>
              <ResultDishPhoto dish={dish} height={220} />
              <View style={{ gap: spacing[1], padding: spacing[3] }}>
                <AppText variant="h2" numberOfLines={2}>
                  {dish.name}
                </AppText>
                <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                  {[dish.venueName, priceLabel === "Price not listed" ? undefined : priceLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
                {chips.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
                    {chips.map((chip) => (
                      <View
                        key={chip}
                        style={{
                          backgroundColor: palette.orangeLight,
                          borderRadius: radii.pill,
                          paddingHorizontal: spacing[2],
                          paddingVertical: spacing[1],
                        }}
                      >
                        <AppText variant="micro">{chip}</AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Card>
          </Animated.View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing[6] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Not for me, ${dish.name}`}
              onPress={() => decide(false)}
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: 64,
                justifyContent: "center",
                width: 64,
              }}
            >
              <X color={palette.textMuted} size={28} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Love it, ${dish.name}`}
              onPress={() => decide(true)}
              style={{
                alignItems: "center",
                backgroundColor: palette.orange,
                borderRadius: radii.pill,
                height: 64,
                justifyContent: "center",
                width: 64,
              }}
            >
              <Heart color={palette.surface} fill={palette.surface} size={28} />
            </Pressable>
          </View>
        </>
      ) : null}
    </OnboardingFrame>
  );
}
