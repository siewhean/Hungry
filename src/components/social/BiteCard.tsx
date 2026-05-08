/**
 * BiteCard — dish-attached micro-review card
 *
 * Displayed in the Bites carousel on the Home Feed.
 * Compact format: 160×220 portrait card.
 */

import { Pressable, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Bookmark, Heart, MessageCircle, MessageCircleMore } from "lucide-react-native";

const CommentIcon = MessageCircle ?? MessageCircleMore;
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
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

interface BiteCardProps {
  bite: Bite;
  onPress?: () => void;
  onDishPress?: () => void;
  width?: number;
  variant?: "portrait" | "compact";
  liked?: boolean;
  saved?: boolean;
  commented?: boolean;
  commentCount?: number;
  likeCount?: number;
  saveCount?: number;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
  onCommentPress?: () => void;
}

export function BiteCard({
  bite,
  onPress,
  onDishPress,
  width = 160,
  variant = "portrait",
  liked = false,
  saved = false,
  commented = false,
  commentCount,
  likeCount,
  saveCount,
  onToggleLike,
  onToggleSave,
  onCommentPress,
}: BiteCardProps) {
  const { palette, radii, spacing, motion } = useHungryTheme();
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

  const displayHeartCount = likeCount ?? bite.cravingCount + (liked ? 1 : 0);
  const displayCommentCount = commentCount ?? (commented ? 1 : 0);
  const displaySaveCount = saveCount ?? bite.savedCount + (saved ? 1 : 0);
  const openDishDetails = onDishPress ?? onPress;

  if (variant === "compact") {
    return (
      <View
        style={{
          width,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: radii.md,
          backgroundColor: palette.surfaceRaised,
          overflow: "hidden",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${bite.dishName} from ${bite.authorName}'s bite`}
          onPress={openDishDetails}
          disabled={!openDishDetails}
        >
          <View style={{ flexDirection: "row" }}>
            <Image
              source={{ uri: bite.photoUrl }}
              style={{ width: 72, height: 92 }}
              contentFit="cover"
            />
            <View style={{ flex: 1, padding: spacing[2], gap: spacing[1] }}>
              <AppText variant="micro" numberOfLines={1}>
                {bite.authorName}
              </AppText>
              <AppText variant="bodySmall" numberOfLines={2} tone="secondary">
                {bite.caption}
              </AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {formatTimeAgo(bite.createdAt)}
              </AppText>
            </View>
          </View>
        </Pressable>

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: spacing[2],
            paddingBottom: spacing[2],
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${saved ? "Unsave" : "Save"} ${bite.dishName}`}
            accessibilityState={{ selected: saved }}
            hitSlop={10}
            onPress={onToggleSave}
            style={{ alignItems: "center", flexDirection: "row", gap: 3 }}
          >
            <Bookmark
              size={16}
              color={saved ? palette.orange : palette.textMuted}
              fill={saved ? palette.orange : "transparent"}
            />
            {displaySaveCount > 0 ? (
              <AppText variant="micro" tone="muted">
                {displaySaveCount}
              </AppText>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Comment on ${bite.dishName}`}
            hitSlop={10}
            onPress={onCommentPress}
            style={{ alignItems: "center", flexDirection: "row", gap: 3 }}
          >
            <CommentIcon size={16} color={palette.textMuted} />
            {displayCommentCount > 0 ? (
              <AppText variant="micro" tone="muted">
                {displayCommentCount}
              </AppText>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${liked ? "Unlike" : "Like"} ${bite.dishName}`}
            accessibilityState={{ selected: liked }}
            hitSlop={10}
            onPress={onToggleLike}
            style={{ alignItems: "center", flexDirection: "row", gap: 3 }}
          >
            <Heart
              size={16}
              color={liked ? palette.error : palette.textMuted}
              fill={liked ? palette.error : "transparent"}
            />
            {displayHeartCount > 0 ? (
              <AppText variant="micro" tone="muted">
                {displayHeartCount}
              </AppText>
            ) : null}
          </Pressable>
        </View>
      </View>
    );
  }

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
            source={{ uri: bite.photoUrl }}
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
              {bite.tasteStamp.spicy >= bite.tasteStamp.sweet ? "Spicy" : "Comfort"}
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
                source={{ uri: bite.authorAvatar || bite.photoUrl }}
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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[3],
          marginTop: spacing[1],
        }}
      >
        <AppText variant="micro" tone="muted">
          {formatTimeAgo(bite.createdAt)}
        </AppText>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Comment on ${bite.dishName}`}
            hitSlop={10}
            onPress={onCommentPress}
            disabled={!onCommentPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <CommentIcon size={18} color={commented ? palette.orange : palette.textMuted} />
            <AppText variant="micro" tone="muted">
              {displayCommentCount}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${saved ? "Unsave" : "Save"} ${bite.dishName}`}
            accessibilityState={{ selected: saved }}
            hitSlop={10}
            onPress={onToggleSave}
            disabled={!onToggleSave}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Bookmark
              size={18}
              color={saved ? palette.orange : palette.textMuted}
              fill={saved ? palette.orange : "transparent"}
            />
            {displaySaveCount > 0 ? (
              <AppText variant="micro" tone="muted">
                {displaySaveCount}
              </AppText>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${liked ? "Unlike" : "Like"} ${bite.dishName}`}
            accessibilityState={{ selected: liked }}
            hitSlop={10}
            onPress={onToggleLike}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
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
        </View>
      </View>
    </View>
  );
}
