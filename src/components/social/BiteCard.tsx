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
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";

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
  onPress?: () => void;
  onDishPress?: () => void;
  width?: number;
  liked?: boolean;
  commented?: boolean;
  onToggleLike?: () => void;
  onCommentPress?: () => void;
}

export function BiteCard({
  bite,
  onPress,
  onDishPress,
  width = 160,
  liked = false,
  commented = false,
  onToggleLike,
  onCommentPress,
}: BiteCardProps) {
  const { palette, radii, spacing, motion } = useHungryTheme();
  const leftHandedMode = useProfileStore((state) => state.profile.leftHandedMode);
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
    .maxDuration(motion.doubleTapWindow)
    .onEnd((_event, success) => {
      if (success && onToggleLike) {
        runOnJS(playHeartAnimation)();
        runOnJS(onToggleLike)();
      }
    });

  const displayHeartCount = bite.heartCount + (liked ? 1 : 0);
  const displayCommentCount = bite.commentCount + (commented ? 1 : 0);
  const openDishDetails = onDishPress ?? onPress;

  return (
    <View
      style={{
        width,
        borderRadius: radii.lg,
        overflow: "hidden",
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          openDishDetails
            ? `View ${bite.dishName} details by ${bite.authorName}`
            : `${bite.dishName} bite by ${bite.authorName}`
        }
        accessibilityHint={
          openDishDetails
            ? "Double tap anywhere on the caption to like. Single tap to see dish details."
            : "Double tap anywhere on the caption to like this bite."
        }
        disabled={!openDishDetails}
        onPress={openDishDetails}
      >
        {/* Dish image */}
        <View
          style={{
            height: imageHeight,
            position: "relative",
            backgroundColor: palette.surfaceRaised,
          }}
        >
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
            <AppText variant="micro" tone="inverse" style={{ fontWeight: "700" }}>
              {bite.tasteTag}
            </AppText>
          </View>
        </View>

        {/* Content */}
        <View style={{ padding: spacing[3], gap: spacing[2] }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radii.pill,
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
            <AppText variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
              {bite.authorName}
            </AppText>
          </View>

          <AppText variant="h3" numberOfLines={1} style={{ fontSize: 13 }}>
            {bite.dishName}
          </AppText>
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
        </View>
      </Pressable>

      {/* Social row */}
      <View
        style={{
          direction: "ltr",
          flexDirection: leftHandedMode ? "row-reverse" : "row",
          alignItems: "center",
          gap: spacing[2],
          marginTop: spacing[1],
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[3],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${liked ? "Unlike" : "Like"} ${bite.dishName}`}
          accessibilityState={{ selected: liked }}
          hitSlop={10}
          onPress={onToggleLike}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[1],
          }}
        >
          <Heart
            size={18}
            color={liked ? palette.error : palette.textMuted}
            fill={liked ? palette.error : "transparent"}
          />
          <AppText variant="micro" tone="muted">
            {displayHeartCount}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${commented ? "Undo comment" : "Comment on"} ${bite.dishName}`}
          hitSlop={10}
          onPress={onCommentPress}
          disabled={!onCommentPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[1],
          }}
        >
          <MessageCircle size={18} color={commented ? palette.orange : palette.textMuted} />
          <AppText variant="micro" tone="muted">
            {displayCommentCount}
          </AppText>
        </Pressable>
        <AppText
          variant="micro"
          tone="muted"
          style={{
            marginLeft: leftHandedMode ? 0 : "auto",
            marginRight: leftHandedMode ? "auto" : 0,
          }}
        >
          {formatTimeAgo(bite.createdAt)}
        </AppText>
      </View>
    </View>
  );
}
