/**
 * BiteCard — dish-attached micro-review card
 *
 * Displayed in the Bites carousel on the Home Feed.
 * Compact format: 160×220 portrait card.
 */

import { Pressable, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Heart, MessageCircle } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export interface Bite {
  id: string;
  dishId: string;
  dishName: string;
  dishImageUrl: string;
  venueName: string;
  authorName: string;
  authorAvatarUrl: string;
  caption: string; // max 80 chars
  heartCount: number;
  commentCount: number;
  tasteTag: string; // e.g. "Spicy kick"
  createdAt: string;
}

interface BiteCardProps {
  bite: Bite;
  onPress: () => void;
  onDishPress?: () => void;
  width?: number;
  liked?: boolean;
  onToggleLike?: () => void;
  onCommentPress?: () => void;
}

export function BiteCard({
  bite,
  onPress,
  onDishPress,
  width = 160,
  liked = false,
  onToggleLike,
  onCommentPress,
}: BiteCardProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const imageHeight = Math.round(width * 0.76);

  const heartScale = useSharedValue(0);
  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value > 0 ? 1 : 0,
  }));

  const playHeartAnimation = () => {
    heartScale.value = withSequence(
      withSpring(1.5, { damping: 12, stiffness: 200 }),
      withDelay(500, withSpring(0)),
    );
  };

  const captionGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((_event, success) => {
      if (success && onToggleLike) {
        runOnJS(playHeartAnimation)();
        runOnJS(onToggleLike)();
      }
    });

  const displayHeartCount = bite.heartCount + (liked ? 1 : 0);

  return (
    <View
      accessibilityLabel={`Bite by ${bite.authorName}: ${bite.dishName}`}
      style={{
        width,
        borderRadius: radii.lg,
        overflow: "hidden",
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      {/* Dish image */}
      <Pressable onPress={onDishPress ?? onPress}>
        <View style={{ height: imageHeight, position: "relative", backgroundColor: palette.surfaceRaised }}>
          <Image
            source={{ uri: bite.dishImageUrl }}
            style={{ width: "100%", height: imageHeight }}
            contentFit="contain"
            transition={200}
          />
          {/* Animated Heart Pop Overlay */}
          <View
            style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
            pointerEvents="none"
          >
            <Animated.View style={animatedHeartStyle}>
              <Heart size={48} color={palette.error} fill={palette.error} />
            </Animated.View>
          </View>
          {/* Taste tag chip */}
          <View
            style={{
              position: "absolute",
              top: spacing[2],
              left: spacing[2],
              backgroundColor: `${palette.orange}EE`,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
            }}
          >
            <AppText variant="micro" style={{ color: "#FFFFFF", fontFamily: "Nunito_700Bold" }}>
              {bite.tasteTag}
            </AppText>
          </View>
        </View>
      </Pressable>

      {/* Content */}
      <View style={{ padding: spacing[3], gap: spacing[2] }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 1.5,
              borderColor: palette.orange,
              overflow: "hidden",
              backgroundColor: palette.surface,
            }}
          >
            <Image
              source={{ uri: bite.authorAvatarUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
          <AppText variant="bodySmall" numberOfLines={1} style={{ fontFamily: "Nunito_700Bold", flex: 1 }}>
            {bite.authorName}
          </AppText>
        </View>

        <Pressable onPress={onDishPress ?? onPress}>
          <AppText
            variant="h3"
            numberOfLines={1}
            style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
          >
            {bite.dishName}
          </AppText>
        </Pressable>
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {bite.venueName}
        </AppText>
        <GestureDetector gesture={captionGesture}>
          <View>
            <AppText
              variant="bodySmall"
              tone="secondary"
              numberOfLines={3}
              style={{ lineHeight: 17 }}
            >
              {bite.caption}
            </AppText>
          </View>
        </GestureDetector>

        {/* Social row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            marginTop: spacing[1],
          }}
        >
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={onToggleLike}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Heart size={18} color={liked ? palette.error : palette.textMuted} />
            <AppText variant="micro" tone="muted">
              {displayHeartCount}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={onCommentPress ?? onPress}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <MessageCircle size={18} color={palette.textMuted} />
            <AppText variant="micro" tone="muted">
              {bite.commentCount}
            </AppText>
          </Pressable>
          <AppText variant="micro" tone="muted" style={{ marginLeft: "auto" }}>
            {bite.createdAt}
          </AppText>
        </View>
      </View>
    </View>
  );
}
