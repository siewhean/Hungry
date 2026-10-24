import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Heart, X, ChevronLeft, Sparkles } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, Button, HungryLogo } from "@/components/ui";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

const SWIPE_THRESHOLD = 120;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function CraveScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const insets = useSafeAreaInsets();
  const { componentRadii, palette, spacing, radii, shadows, motion, zIndex } = useHungryTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Reduce Motion: cards leave instantly and do not tilt while dragged.
  const reduceMotion = useReduceMotion();
  const swipeOutDuration = reduceMotion ? 0 : motion.craveSwipe;
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  // Get a set of appealing dishes for swiping
  const [dishes, setDishes] = useState<DishDetail[]>(() => {
    return repository
      .listBuildings()
      .flatMap((b) => repository.listVenuesByBuilding(b.id))
      .flatMap((v) => repository.listDishesByVenue(v.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);
  });
  // The saved cache can be empty on a first open. Then the deck comes from the
  // service, and "You've seen it all" is only ever said after dishes were shown.
  const [isLoadingDeck, setIsLoadingDeck] = useState(dishes.length === 0);
  const hadDeckRef = useRef(dishes.length > 0);
  useEffect(() => {
    if (hadDeckRef.current) return;
    let isActive = true;
    void getHungryService()
      .discovery.searchDishes(
        {
          query: "",
          categories: [],
          dietaryFlags: profile.dietaryPreferences,
          tasteValues: profile.tasteVector,
          radius: 3000,
        },
        profile.tasteVector,
      )
      .then((results) => {
        if (!isActive) return;
        const deck = results
          .map((result) => result.dish)
          .sort(() => Math.random() - 0.5)
          .slice(0, 20);
        hadDeckRef.current = deck.length > 0;
        setDishes(deck);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setIsLoadingDeck(false);
      });
    return () => {
      isActive = false;
    };
    // Runs once for the empty-cache open; the profile is read as it was then.
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  const currentDish = dishes[currentIndex];
  const nextDish = dishes[currentIndex + 1];

  // The responder is created once, so it calls the latest handlers through refs;
  // otherwise every swipe would act on the first render's dish and auth state.
  const swipeHandlersRef = useRef({ swipeRight: () => {}, swipeLeft: () => {} });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          swipeHandlersRef.current.swipeRight();
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          swipeHandlersRef.current.swipeLeft();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const swipeRight = () => {
    if (!isAuthenticated) {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        useNativeDriver: true,
      }).start();
      setReturnRoute({ name: "Crave" });
      showToast({ message: "Sign in to save dishes.", tone: "warning" });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (currentDish) {
      // Saving is idempotent: a dish that is already saved is liked, never unsaved.
      if (profile.favouriteDishIds.includes(currentDish.id)) {
        recordTasteInteraction({
          type: "dish_like",
          surface: "discover",
          dish: currentDish,
          buttonId: "crave_swipe_right",
        });
      } else {
        toggleFavourite(currentDish);
      }
    }

    Animated.timing(position, {
      toValue: { x: screenWidth + 100, y: 0 },
      duration: swipeOutDuration,
      useNativeDriver: true,
    }).start(() => nextCard());
  };

  const swipeLeft = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentDish) {
      recordTasteInteraction({
        type: "dismissed",
        surface: "discover",
        dish: currentDish,
        buttonId: "crave_swipe_left",
      });
    }
    Animated.timing(position, {
      toValue: { x: -screenWidth - 100, y: 0 },
      duration: swipeOutDuration,
      useNativeDriver: true,
    }).start(() => nextCard());
  };

  swipeHandlersRef.current = { swipeRight, swipeLeft };

  const nextCard = () => {
    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });
  };

  const rotation = position.x.interpolate({
    inputRange: [-screenWidth / 2, 0, screenWidth / 2],
    outputRange: reduceMotion ? ["0deg", "0deg", "0deg"] : ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, screenWidth / 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-screenWidth / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  if (!currentDish) {
    const hasSwipedDeck = hadDeckRef.current;
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[8],
        }}
      >
        <Sparkles color={palette.orange} size={48} style={{ marginBottom: spacing[4] }} />
        <AppText variant="h2" style={{ textAlign: "center" }}>
          {isLoadingDeck
            ? "Finding dishes for you…"
            : hasSwipedDeck
              ? "You've seen it all!"
              : "No dishes to swipe yet"}
        </AppText>
        <AppText
          tone="secondary"
          style={{
            textAlign: "center",
            marginTop: spacing[2],
            marginBottom: spacing[6],
          }}
        >
          {isLoadingDeck
            ? "Hang on a moment."
            : hasSwipedDeck
              ? "Your taste profile is getting sharper. Go check out your updated Fingerprint."
              : "Check your connection and try again later."}
        </AppText>
        <Button label="Back to Discover" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.navy }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={4}
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft color={palette.white} size={28} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <AppText
              style={{
                color: palette.textOnDark,
                fontWeight: "900",
                fontSize: 18,
                letterSpacing: 1,
              }}
            >
              CRAVE
            </AppText>
            <AppText variant="micro" style={{ color: palette.inverseTextMuted }}>
              SWIPE TO BUILD PROFILE
            </AppText>
          </View>
          <View style={{ width: 40, height: 40 }} />
        </View>

        <View style={{ flex: 1, padding: spacing[4], justifyContent: "center" }}>
          {/* Next Card (Background) */}
          {nextDish && (
            <View
              style={[StyleSheet.absoluteFill, { padding: spacing[4], justifyContent: "center" }]}
            >
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    opacity: 0.5,
                    transform: [{ scale: 0.95 }],
                  },
                ]}
              >
                <AccessibleImage
                  source={{ uri: nextDish.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={`${nextDish.name} preview photo`}
                />
              </View>
            </View>
          )}

          {/* Current Card */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderRadius: componentRadii.card,
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate: rotation },
                ],
              },
              shadows.floating,
            ]}
          >
            <AccessibleImage
              source={{ uri: currentDish.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${currentDish.name} photo`}
            />

            {/* Feedback Overlays */}
            <Animated.View
              style={[
                styles.overlayLabel,
                {
                  borderColor: palette.teal,
                  right: 40,
                  top: 40,
                  opacity: likeOpacity,
                  transform: [{ rotate: "15deg" }],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  zIndex: zIndex.overlay,
                },
              ]}
            >
              <AppText style={{ color: palette.teal, fontWeight: "900", fontSize: 32 }}>
                CRAVE
              </AppText>
            </Animated.View>
            <Animated.View
              style={[
                styles.overlayLabel,
                {
                  borderColor: palette.error,
                  left: 40,
                  top: 40,
                  opacity: passOpacity,
                  transform: [{ rotate: "-15deg" }],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  zIndex: zIndex.overlay,
                },
              ]}
            >
              <AppText
                style={{
                  color: palette.error,
                  fontWeight: "900",
                  fontSize: 32,
                }}
              >
                PASS
              </AppText>
            </Animated.View>

            <View
              style={[
                styles.cardInfo,
                { backgroundColor: palette.mediaScrim, padding: spacing[6] },
              ]}
            >
              <View style={{ gap: spacing[0.5] }}>
                <AppText
                  style={{
                    color: palette.textOnDark,
                    fontSize: 28,
                    fontWeight: "900",
                  }}
                >
                  {currentDish.name}
                </AppText>
                <AppText
                  style={{
                    color: palette.inverseTextSecondary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {currentDish.venueName}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing[2],
                  marginTop: spacing[2],
                }}
              >
                {currentDish.tasteTags.slice(0, 3).map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: palette.inverseSurfaceSubtle,
                      paddingHorizontal: spacing[2.5],
                      paddingVertical: spacing[1],
                      borderRadius: radii.sm,
                    }}
                  >
                    <AppText
                      variant="micro"
                      style={{ color: palette.textOnDark, fontWeight: "700" }}
                    >
                      {tag.toUpperCase()}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: spacing[8],
            paddingBottom: Math.max(insets.bottom, spacing[8]),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentDish ? `Pass on ${currentDish.name}` : "Pass"}
            onPress={swipeLeft}
            style={({ pressed }) => [
              {
                width: 72,
                height: 72,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.inverseSurfaceFaint,
                borderColor: palette.error,
                borderWidth: 2,
                borderRadius: componentRadii.iconButton,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <X color={palette.error} size={32} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentDish ? `Save ${currentDish.name}` : "Save"}
            onPress={swipeRight}
            style={({ pressed }) => [
              {
                width: 72,
                height: 72,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.orange,
                borderRadius: componentRadii.iconButton,
              },
              pressed && { scale: 0.9, opacity: 0.9 },
            ]}
          >
            <Heart color={palette.textOnOrange} fill={palette.textOnOrange} size={32} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  overlayLabel: {
    position: "absolute",
    borderWidth: 4,
  },
});
