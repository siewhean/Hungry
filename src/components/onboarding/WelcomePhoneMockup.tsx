import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { AppText } from "@/components/ui";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { ONBOARDING_FOOD_IMAGES } from "@/app/screens/onboarding/onboardingFoodImages";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";

/** How long each Hungry screen stays in the phone before the next fades in. */
export const WELCOME_SLIDE_MS = 2800;
export const WELCOME_SLIDE_COUNT = 3;

type Props = {
  width: number;
  /** Called when the visible screen changes, so the caption below can follow along. */
  onSlideChange?: (index: number) => void;
};

const NEARBY = [
  { name: "Laksa", tag: "Rich · Spicy", image: ONBOARDING_FOOD_IMAGES.laksa },
  { name: "Chicken rice", tag: "Savoury · Mild", image: ONBOARDING_FOOD_IMAGES.chickenRice },
  { name: "Char kway teow", tag: "Smoky · Savoury", image: ONBOARDING_FOOD_IMAGES.charKwayTeow },
];

const TASTE_BARS = [
  { label: "Spicy", value: 0.8 },
  { label: "Sweet", value: 0.35 },
  { label: "Rich", value: 0.9 },
  { label: "Sour", value: 0.5 },
];

/**
 * A phone that cycles through three Hungry screens (dishes near you, a dish page, your taste
 * profile) with a gentle float. Decorative: hidden from screen readers. Under Reduce Motion it
 * shows the first screen and stands still.
 */
export function WelcomePhoneMockup({ width, onSlideChange }: Props) {
  const { palette, radii } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const [active, setActive] = useState(0);
  const fades = useRef(
    Array.from({ length: WELCOME_SLIDE_COUNT }, (_, i) => new Animated.Value(i === 0 ? 1 : 0)),
  ).current;
  const float = useRef(new Animated.Value(0)).current;

  const height = Math.round(width * 1.85);
  const bezel = Math.max(6, Math.round(width * 0.03));
  const frameRadius = Math.round(width * 0.17);
  const innerWidth = width - bezel * 2;
  const unit = innerWidth / 200;

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % WELCOME_SLIDE_COUNT),
      WELCOME_SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    onSlideChange?.(active);
    const fade = Animated.parallel(
      fades.map((value, i) =>
        Animated.timing(value, {
          toValue: i === active ? 1 : 0,
          duration: reduceMotion ? 0 : 500,
          useNativeDriver: true,
        }),
      ),
    );
    fade.start();
    return () => fade.stop();
  }, [active, fades, onSlideChange, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      float.stopAnimation();
    };
  }, [float, reduceMotion]);

  const card = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.md,
  } as const;

  return (
    <Animated.View
      testID="welcome-phone-mockup"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: frameRadius,
        padding: bezel,
        backgroundColor: palette.navy,
        shadowColor: palette.navy,
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        elevation: 12,
        transform: [
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: frameRadius - bezel,
          overflow: "hidden",
          backgroundColor: palette.bg,
        }}
      >
        {/* Notch */}
        <View
          style={{
            position: "absolute",
            top: 8 * unit,
            alignSelf: "center",
            width: 56 * unit,
            height: 14 * unit,
            borderRadius: 8 * unit,
            backgroundColor: palette.navy,
            zIndex: 2,
          }}
        />

        {/* 1. Dishes near you */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: fades[0],
            padding: 12 * unit,
            paddingTop: 34 * unit,
          }}
        >
          <AppText variant="bodyBold" style={{ fontSize: 13 * unit * 1.1 }}>
            Near you
          </AppText>
          <View style={{ marginTop: 8 * unit, gap: 8 * unit }}>
            {NEARBY.map((dish) => (
              <View
                key={dish.name}
                style={[
                  card,
                  { flexDirection: "row", alignItems: "center", padding: 6 * unit, gap: 8 * unit },
                ]}
              >
                <AccessibleImage
                  decorative
                  source={dish.image}
                  style={{ width: 44 * unit, height: 44 * unit, borderRadius: radii.sm }}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="bodyBold"
                    style={{ fontSize: 11 * unit * 1.1 }}
                    numberOfLines={1}
                  >
                    {dish.name}
                  </AppText>
                  <AppText
                    variant="micro"
                    tone="secondary"
                    style={{ fontSize: 9 * unit * 1.1 }}
                    numberOfLines={1}
                  >
                    {dish.tag}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* 2. A dish page */}
        <Animated.View
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: fades[1] }}
        >
          <AccessibleImage
            decorative
            source={ONBOARDING_FOOD_IMAGES.nasiLemak}
            style={{ width: innerWidth, height: innerWidth * 0.95 }}
            contentFit="cover"
          />
          <View style={{ padding: 12 * unit, gap: 6 * unit }}>
            <AppText variant="bodyBold" style={{ fontSize: 15 * unit * 1.1 }}>
              Nasi lemak
            </AppText>
            <View style={{ flexDirection: "row", gap: 6 * unit }}>
              {["Creamy", "Fragrant", "Mild heat"].map((chip) => (
                <View
                  key={chip}
                  style={{
                    backgroundColor: palette.orangeLight,
                    borderRadius: radii.pill,
                    paddingHorizontal: 7 * unit,
                    paddingVertical: 3 * unit,
                  }}
                >
                  <AppText
                    variant="micro"
                    style={{ fontSize: 9 * unit * 1.1, color: palette.accentText }}
                  >
                    {chip}
                  </AppText>
                </View>
              ))}
            </View>
            <View
              style={{
                marginTop: 6 * unit,
                backgroundColor: palette.orange,
                borderRadius: radii.pill,
                paddingVertical: 8 * unit,
                alignItems: "center",
              }}
            >
              <AppText
                variant="bodyBold"
                style={{ fontSize: 11 * unit * 1.1, color: palette.textOnOrange }}
              >
                I tried this
              </AppText>
            </View>
          </View>
        </Animated.View>

        {/* 3. Your taste */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: fades[2],
            padding: 12 * unit,
            paddingTop: 34 * unit,
          }}
        >
          <AppText variant="bodyBold" style={{ fontSize: 13 * unit * 1.1 }}>
            Your taste
          </AppText>
          <View style={[card, { marginTop: 8 * unit, padding: 10 * unit, gap: 10 * unit }]}>
            {TASTE_BARS.map((bar) => (
              <View key={bar.label} style={{ gap: 3 * unit }}>
                <AppText variant="micro" tone="secondary" style={{ fontSize: 9 * unit * 1.1 }}>
                  {bar.label}
                </AppText>
                <View
                  style={{
                    height: 8 * unit,
                    borderRadius: radii.pill,
                    backgroundColor: palette.bgSoft,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(bar.value * 100)}%`,
                      height: "100%",
                      borderRadius: radii.pill,
                      backgroundColor: palette.orange,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
