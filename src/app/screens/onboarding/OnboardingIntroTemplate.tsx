/**
 * OnboardingIntroTemplate — rich stories-style layout
 *
 * Features:
 *  - Progress bar with N segments (auto-fills current)
 *  - Large illustrative icon/visual area per slide
 *  - Eyebrow label + headline + body copy
 *  - Feature bullets with animated entrance
 *  - Bottom CTA with back/skip options (skip jumps past the taste setup to location)
 *  - Tap anywhere on top 60% to advance (like Instagram Stories)
 */

import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View, StyleSheet } from "react-native";
import type { PropsWithChildren } from "react";
import { ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";
import type { OnboardingStackParamList } from "./OnboardingStack";
import { ONBOARDING_ACTIONS_BOTTOM_PADDING, ONBOARDING_ACTIONS_GAP } from "./layoutConstants";

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ total, current }: { total: number; current: number }) {
  const { motion, palette, radii } = useHungryTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: motion.onboardingSegmentFill,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [current, motion.onboardingSegmentFill]);

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressTrack,
            {
              backgroundColor: `${palette.orange}30`,
              borderRadius: radii.pill,
              flex: 1,
            },
          ]}
        >
          {i < current ? (
            // Completed segment
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: palette.orange,
                  borderRadius: radii.pill,
                  width: "100%",
                },
              ]}
            />
          ) : i === current ? (
            // Active segment — animated fill
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: palette.orange,
                  borderRadius: radii.pill,
                  width: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ─── Slide illustration (abstract) ────────────────────────────────────────────

function SlideIllustration({ step, accentColor }: { step: number; accentColor: string }) {
  const { palette, radii } = useHungryTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      damping: 14,
      mass: 0.9,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [step]);

  const shapes: Record<number, React.ReactNode> = {
    0: (
      // Dish-first: bowl + chopsticks silhouette
      <View style={styles.illustrationInner}>
        <View style={[styles.bowl, { borderColor: accentColor }]}>
          <View style={[styles.bowlContent, { backgroundColor: `${accentColor}44` }]}>
            <View
              style={[
                styles.steamLine,
                {
                  backgroundColor: accentColor,
                  borderRadius: radii.pill,
                  marginLeft: -12,
                },
              ]}
            />
            <View
              style={[styles.steamLine, { backgroundColor: accentColor, borderRadius: radii.pill }]}
            />
            <View
              style={[
                styles.steamLine,
                {
                  backgroundColor: accentColor,
                  borderRadius: radii.pill,
                  marginLeft: 12,
                },
              ]}
            />
          </View>
        </View>
      </View>
    ),
    1: (
      // Map / location: concentric circles + pin
      <View style={styles.illustrationInner}>
        {[120, 84, 48].map((size, i) => (
          <View
            key={i}
            style={[
              styles.mapRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: `${accentColor}${i === 0 ? "22" : i === 1 ? "55" : "AA"}`,
              },
            ]}
          />
        ))}
        <View style={[styles.mapPin, { backgroundColor: accentColor, borderRadius: radii.pill }]}>
          <View
            style={[styles.mapPinDot, { backgroundColor: palette.white, borderRadius: radii.pill }]}
          />
        </View>
      </View>
    ),
    2: (
      // Social Bites: stacked cards
      <View style={styles.illustrationInner}>
        {[0.7, 0.84, 1].map((scale, i) => (
          <View
            key={i}
            style={[
              styles.biteCard,
              {
                backgroundColor: i === 2 ? accentColor : `${accentColor}${i === 1 ? "66" : "33"}`,
                transform: [
                  { scale },
                  { translateY: (2 - i) * -18 },
                  { rotate: `${(i - 1) * 4}deg` },
                ],
                zIndex: i,
              },
            ]}
          />
        ))}
      </View>
    ),
    3: (
      // Taste AI: hexagon pattern
      <View style={styles.illustrationInner}>
        <View style={[styles.hexGrid]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.hexCell,
                {
                  backgroundColor: i % 2 === 0 ? accentColor : `${accentColor}44`,
                  opacity: 0.6 + (i / 6) * 0.4,
                  width: 30 + (i % 3) * 8,
                  height: 30 + (i % 3) * 8,
                  borderRadius: 8,
                  transform: [{ rotate: `${i * 15}deg` }],
                },
              ]}
            />
          ))}
        </View>
      </View>
    ),
  };

  return (
    <Animated.View
      style={[
        styles.illustrationContainer,
        {
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
      ]}
    >
      {shapes[step] ?? shapes[0]}
    </Animated.View>
  );
}

// ─── Bullet item ──────────────────────────────────────────────────────────────

function BulletItem({ text, index }: { text: string; index: number }) {
  const { motion, palette, spacing, radii } = useHungryTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: motion.onboardingBulletEnter,
      delay: motion.buttonPress * 2 + index * motion.buttonPress,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [index, motion.buttonPress, motion.onboardingBulletEnter]);

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        gap: spacing[2],
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          backgroundColor: palette.orange,
          borderRadius: radii.pill,
          height: 7,
          marginTop: 9,
          width: 7,
          flexShrink: 0,
        }}
      />
      <AppText style={{ flex: 1, color: palette.textSecondary, lineHeight: 22 }}>{text}</AppText>
    </Animated.View>
  );
}

// ─── Main template ─────────────────────────────────────────────────────────────

interface OnboardingIntroTemplateProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  /** 1-based index of this screen */
  stepIndex: number;
  /** Total number of intro steps (default 3) */
  totalSteps?: number;
  eyebrow: string;
  bullets: string[];
  navigation: {
    navigate: (screen: keyof OnboardingStackParamList) => void;
    goBack?: () => void;
  };
  nextScreen: keyof OnboardingStackParamList;
  backScreen?: keyof OnboardingStackParamList;
}

export function OnboardingIntroTemplate({
  title,
  subtitle,
  stepIndex,
  totalSteps = 3,
  eyebrow,
  bullets,
  navigation,
  nextScreen,
  backScreen,
}: OnboardingIntroTemplateProps) {
  const { motion, palette, radii, spacing, shadows, zIndex } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const setSkippedTasteQuiz = useSessionStore((state) => state.setSkippedTasteQuiz);
  const skipTasteSetup = () => {
    setSkippedTasteQuiz(true);
    navigation.navigate("LocationPermission");
  };

  const headlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    headlineAnim.setValue(0);
    Animated.timing(headlineAnim, {
      toValue: 1,
      duration: motion.onboardingHeadlineEnter,
      delay: motion.buttonPress,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [headlineAnim, motion.buttonPress, motion.onboardingHeadlineEnter, stepIndex]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* ── Top: progress + header ──────────────────────── */}
      <View
        style={[
          styles.topArea,
          {
            paddingTop: insets.top + spacing[3],
            zIndex: zIndex.overlay,
          },
        ]}
      >
        <ProgressBar total={totalSteps} current={stepIndex - 1} />

        <View style={styles.topRow}>
          <View style={styles.backBtn} />

          <Pressable
            onPress={skipTasteSetup}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 4,
              justifyContent: "center",
              minHeight: 44,
              minWidth: 52,
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip taste setup"
            accessibilityHint="Goes straight to choosing your location"
          >
            <AppText variant="bodySmallBold" tone="muted">
              Skip
            </AppText>
            <ChevronRight size={14} color={palette.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Illustration ────────────────────────────────── */}
      <Pressable
        style={styles.illustrationArea}
        onPress={() => navigation.navigate(nextScreen)}
        accessibilityRole="button"
        accessibilityLabel="Continue to the next step"
      >
        <SlideIllustration step={stepIndex - 1} accentColor={palette.orange} />
      </Pressable>

      {/* ── Content ─────────────────────────────────────── */}
      <View
        style={[styles.contentArea, { backgroundColor: palette.surface, ...shadows.bottomSheet }]}
      >
        {/* Eyebrow */}
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: `${palette.orange}22`,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
            marginBottom: spacing[2],
          }}
        >
          <AppText
            variant="micro"
            style={{ color: palette.orange, fontFamily: "Nunito_800ExtraBold" }}
          >
            {eyebrow.toUpperCase()}
          </AppText>
        </View>

        {/* Headline */}
        <Animated.View
          style={{
            opacity: headlineAnim,
            transform: [
              {
                translateY: headlineAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          <AppText variant="h1" style={{ marginBottom: spacing[2] }}>
            {title}
          </AppText>
          <AppText tone="secondary" style={{ marginBottom: spacing[4], lineHeight: 22 }}>
            {subtitle}
          </AppText>
        </Animated.View>

        {/* Bullets */}
        <View style={{ flex: 1, gap: spacing[3], marginBottom: spacing[8] }}>
          {bullets.map((bullet, i) => (
            <BulletItem key={bullet} text={bullet} index={i} />
          ))}
        </View>

        {/* CTA */}
        <View
          style={{
            gap: ONBOARDING_ACTIONS_GAP,
            marginHorizontal: -8,
            marginTop: spacing[2],
            paddingBottom: ONBOARDING_ACTIONS_BOTTOM_PADDING + spacing[2],
          }}
        >
          <Button
            label={stepIndex < totalSteps ? "Continue" : "Set up my taste"}
            onPress={() => navigation.navigate(nextScreen)}
          />
          {backScreen ? (
            <Button label="Back" variant="ghost" onPress={() => navigation.navigate(backScreen)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topArea: {
    paddingHorizontal: 20,
    gap: 12,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    height: 3,
  },
  progressTrack: {
    height: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationArea: {
    flex: 1,
    minHeight: 156,
    maxHeight: 208,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationContainer: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationInner: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  contentArea: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 0,
  },
  // Bowl illustration
  bowl: {
    width: 100,
    height: 60,
    borderWidth: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bowlContent: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
    paddingBottom: 8,
  },
  steamLine: {
    width: 3,
    height: 20,
    opacity: 0.8,
  },
  // Map pin illustration
  mapRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  mapPin: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinDot: {
    width: 8,
    height: 8,
  },
  // Bite cards
  biteCard: {
    position: "absolute",
    width: 100,
    height: 64,
    borderRadius: componentRadii.card,
  },
  // Hex grid
  hexGrid: {
    width: 120,
    height: 120,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hexCell: {},
});
