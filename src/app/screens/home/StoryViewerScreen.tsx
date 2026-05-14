import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { X, Heart, MessageCircle, MessageCircleMore, Bookmark } from "lucide-react-native";
import { AppText, IconButton, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useStoryStore } from "@/store/useStoryStore";
import { RootStackParamList } from "@/app/navigation/navigationTypes";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";

import { useUIStore } from "@/store/useUIStore";

const CommentIcon = MessageCircle ?? MessageCircleMore;

const STORY_DURATION = 5000;
const SWIPE_THRESHOLD = 48;
const STORY_ROTATE_ANGLE = 105;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const StoryMedia = React.memo(function StoryMedia({
  uri,
  rotateY,
}: {
  uri: string;
  rotateY: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backfaceVisibility: "hidden",
          transform: [
            { perspective: 520 },
            {
              rotateY: rotateY.interpolate({
                inputRange: [-STORY_ROTATE_ANGLE, 0, STORY_ROTATE_ANGLE],
                outputRange: [`-${STORY_ROTATE_ANGLE}deg`, "0deg", `${STORY_ROTATE_ANGLE}deg`],
              }),
            },
            {
              scale: rotateY.interpolate({
                inputRange: [-STORY_ROTATE_ANGLE, 0, STORY_ROTATE_ANGLE],
                outputRange: [0.9, 1, 0.9],
              }),
            },
          ],
        },
      ]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
  );
});

function orderedStoriesFrom<T>(items: T[], startIndex: number): T[] {
  const safeStart = Math.max(startIndex, 0);
  return [...items.slice(safeStart), ...items.slice(0, safeStart)];
}

export function StoryViewerScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "StoryViewer">>();
  const initialStoryId = route.params.initialStoryId;

  const { stories, loadStories, likeStory, saveStory, markSeenForDisplayName } = useStoryStore();
  const showToast = useUIStore((state) => state.showToast);
  const [activeStoryId, setActiveStoryId] = useState(() => initialStoryId);
  const [isPaused, setIsPaused] = useState(false);
  const [hasRequestedStories, setHasRequestedStories] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const closeOpacity = useRef(new Animated.Value(1)).current;
  const trackWidthsRef = useRef<Record<string, number>>({});
  const progressValueRef = useRef(0);
  const playbackStoryIdsRef = useRef<string[]>([]);

  const currentStory = stories.find((story) => story.id === activeStoryId);
  const playbackIndex = playbackStoryIdsRef.current.indexOf(activeStoryId);

  useEffect(() => {
    if (stories.length === 0) {
      if (!hasRequestedStories) {
        setHasRequestedStories(true);
        void loadStories();
      }
      return;
    }

    if (playbackStoryIdsRef.current.length === 0) {
      const initialIndex = stories.findIndex((story) => story.id === initialStoryId);
      const selectedStory = initialIndex >= 0 ? stories[initialIndex] : stories[0];
      const orderedFromSelection = orderedStoriesFrom(stories, initialIndex);

      if (selectedStory.hasUnseen && !selectedStory.isOwn) {
        const unseenStoryIds = orderedFromSelection
          .filter((story) => story.hasUnseen && !story.isOwn)
          .map((story) => story.id);
        playbackStoryIdsRef.current = unseenStoryIds.length
          ? unseenStoryIds
          : orderedFromSelection.map((story) => story.id);
      } else {
        playbackStoryIdsRef.current = orderedFromSelection.map((story) => story.id);
      }

      setActiveStoryId(playbackStoryIdsRef.current[0]);
      return;
    }

    if (!stories.some((story) => story.id === activeStoryId)) {
      setActiveStoryId(playbackStoryIdsRef.current[0] ?? stories[0].id);
    }
  }, [activeStoryId, hasRequestedStories, initialStoryId, loadStories, stories]);

  const userStories = currentStory
    ? stories.filter((s) => s.displayName === currentStory.displayName)
    : [];
  const subIndex = currentStory ? userStories.findIndex((s) => s.id === currentStory.id) : 0;

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => progressAnim.removeListener(listenerId);
  }, [progressAnim]);

  useEffect(() => {
    progressValueRef.current = 0;
    progressAnim.setValue(0);
    rotateY.setValue(0);
    closeOpacity.setValue(1);
  }, [closeOpacity, currentStory?.id, progressAnim, rotateY]);

  const runRotateTransition = (nextId: string, direction: "next" | "prev") => {
    const outAngle = direction === "next" ? -STORY_ROTATE_ANGLE : STORY_ROTATE_ANGLE;
    const inAngle = direction === "next" ? STORY_ROTATE_ANGLE : -STORY_ROTATE_ANGLE;
    Animated.timing(rotateY, {
      toValue: outAngle,
      duration: 320,
      useNativeDriver: true,
    }).start(() => {
      setActiveStoryId(nextId);
      rotateY.setValue(inAngle);
      Animated.timing(rotateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeWithFade = useCallback(() => {
    setIsPaused(true);
    Animated.timing(closeOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  }, [closeOpacity, navigation]);

  const handlePrevious = useCallback(() => {
    if (!currentStory) return;
    if (playbackIndex > 0) {
      const prev = stories.find(
        (story) => story.id === playbackStoryIdsRef.current[playbackIndex - 1],
      );
      if (!prev) return;
      // If previous story belongs to the same user, just go back instantly
      if (prev && prev.displayName === currentStory.displayName) {
        setActiveStoryId(prev.id);
        return;
      }

      // Different user — rotate the block to indicate a user change
      runRotateTransition(prev.id, "prev");
    } else {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: STORY_DURATION,
        useNativeDriver: false,
      }).start();
    }
  }, [currentStory, playbackIndex, progressAnim, stories]);

  const handleNext = useCallback(() => {
    if (!currentStory) return;
    if (playbackIndex >= 0 && playbackIndex < playbackStoryIdsRef.current.length - 1) {
      const next = stories.find(
        (story) => story.id === playbackStoryIdsRef.current[playbackIndex + 1],
      );
      if (!next) return;
      // If next story belongs to the same user, just advance without swipe
      if (next && next.displayName === currentStory.displayName) {
        setActiveStoryId(next.id);
        return;
      }

      // Mark current user's stories as seen before switching user
      if (currentStory) markSeenForDisplayName(currentStory.displayName);

      // Different user — rotate the block to indicate a user change
      runRotateTransition(next.id, "next");
    } else {
      // End of list — mark seen for this user and close
      if (currentStory) markSeenForDisplayName(currentStory.displayName);
      closeWithFade();
    }
  }, [closeWithFade, currentStory, markSeenForDisplayName, playbackIndex, stories]);

  useEffect(() => {
    if (!currentStory) return;
    if (isPaused) {
      progressAnim.stopAnimation();
      return;
    }
    const remainingDuration = Math.max(0, (1 - progressValueRef.current) * STORY_DURATION);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });
    return () => animation.stop();
  }, [currentStory?.id, handleNext, isPaused, progressAnim]);

  const gestureResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > SWIPE_THRESHOLD ||
          Math.abs(gestureState.dy) > SWIPE_THRESHOLD,
        onPanResponderGrant: () => setIsPaused(true),
        onPanResponderRelease: (_event, gestureState) => {
          setIsPaused(false);
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);

          if (absDx > absDy && absDx > SWIPE_THRESHOLD) {
            if (gestureState.dx < 0) {
              handleNext();
            } else {
              handlePrevious();
            }
            return;
          }

          if (gestureState.dy > SWIPE_THRESHOLD) {
            closeWithFade();
          }
        },
        onPanResponderTerminate: () => setIsPaused(false),
      }),
    [closeWithFade, handleNext, handlePrevious],
  );

  const onLike = async () => {
    if (!currentStory) return;
    try {
      await likeStory(currentStory.id);
    } catch (e) {
      showToast({ message: "Failed to like story", tone: "error" });
    }
  };

  const onSave = async () => {
    if (!currentStory) return;
    try {
      await saveStory(currentStory.id);
      showToast({
        message: currentStory.interaction.saved ? "Story removed from saved" : "Story saved",
        tone: "success",
      });
    } catch (e) {
      showToast({ message: "Failed to save story", tone: "error" });
    }
  };

  const handleStoryMessage = () => {
    if (!currentStory) {
      return;
    }

    if (currentStory.isOwn) {
      navigation.navigate("AddStory");
      return;
    }

    const chatId = `story-${currentStory.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    navigation.navigate("ChatDetail", {
      chatId,
      name: currentStory.displayName,
      avatar: currentStory.avatarUrl || currentStory.content.url,
      isOnline: false,
    });
  };

  // Mark stories for this user as seen when first opened/viewed so the carousel shows grey ring
  useEffect(() => {
    if (currentStory?.hasUnseen) {
      markSeenForDisplayName(currentStory.displayName);
    }
  }, [currentStory?.id, currentStory?.hasUnseen]);

  if (!currentStory) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={palette.white} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: "#000", opacity: closeOpacity }]}>
      <StoryMedia uri={currentStory.content.url} rotateY={rotateY} />

      <View
        style={[
          styles.navigationLayer,
          {
            top: insets.top + 72,
            bottom: Math.max(insets.bottom, spacing[4]) + 72,
          },
        ]}
        {...gestureResponder.panHandlers}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          style={styles.tapZone}
          onPress={handlePrevious}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          style={styles.tapZone}
          onPress={handleNext}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
      </View>

      <View
        style={[styles.headerOverlay, { paddingTop: insets.top + spacing[2] }]}
        pointerEvents="box-none"
      >
        <View style={[styles.progressBarContainer]} pointerEvents="none">
          {userStories.map((story, idx) => (
            <View
              key={story.id}
              style={[
                styles.progressBarTrack,
                { backgroundColor: "rgba(255, 255, 255, 0.3)", borderRadius: radii.pill },
              ]}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                trackWidthsRef.current[story.id] = w;
              }}
            >
              {idx < subIndex && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: palette.white, borderRadius: radii.pill },
                  ]}
                />
              )}
              {idx === subIndex && (
                <Animated.View
                  pointerEvents="none"
                  style={(() => {
                    const measured = trackWidthsRef.current[story.id] || 0;
                    if (measured > 0) {
                      return [
                        {
                          height: "100%",
                          backgroundColor: palette.white,
                          borderRadius: radii.pill,
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, measured],
                          }),
                        },
                      ];
                    }

                    // Fallback to percentage-based width while measurement isn't available
                    return [
                      {
                        height: "100%",
                        backgroundColor: palette.white,
                        borderRadius: radii.pill,
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }) as unknown as number,
                      },
                    ];
                  })()}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.userInfoRow} pointerEvents="box-none">
          <View style={styles.userInfoLeft} pointerEvents="none">
            <Avatar uri={currentStory.avatarUrl} name={currentStory.displayName} size={32} />
            <AppText style={{ color: palette.white, fontWeight: "bold", marginLeft: 8 }}>
              {currentStory.displayName}
            </AppText>
            <AppText style={{ color: "rgba(255,255,255,0.7)", marginLeft: 8, fontSize: 12 }}>
              {formatTimeAgo(new Date(currentStory.createdAt))}
            </AppText>
          </View>
          <IconButton
            icon={<X color={palette.white} size={24} />}
            onPress={closeWithFade}
            accessibilityLabel="Close story"
          />
        </View>
      </View>

      <View
        style={[styles.footerOverlay, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            currentStory.isOwn ? "Add another story" : `Message ${currentStory.displayName}`
          }
          style={styles.inputSimulator}
          onPress={handleStoryMessage}
        >
          <CommentIcon color={palette.white} size={18} />
          <AppText style={{ color: palette.white }}>
            {currentStory.isOwn ? "Add story" : "Send message"}
          </AppText>
        </Pressable>
        <View style={styles.actionsRow}>
          <View style={styles.actionButtonStack}>
            <IconButton
              icon={
                <Heart
                  color={currentStory.interaction.liked ? palette.error : palette.white}
                  fill={currentStory.interaction.liked ? palette.error : "transparent"}
                  size={28}
                />
              }
              onPress={onLike}
              accessibilityLabel="Like story"
            />
            <AppText style={styles.actionCountText}>
              {currentStory.interaction.likeCount > 0 ? currentStory.interaction.likeCount : " "}
            </AppText>
          </View>

          <View style={styles.actionButtonStack}>
            <IconButton
              icon={
                <Bookmark
                  color={currentStory.interaction.saved ? palette.orange : palette.white}
                  fill={currentStory.interaction.saved ? palette.orange : "transparent"}
                  size={28}
                />
              }
              onPress={onSave}
              accessibilityLabel="Save story"
            />
            <AppText style={styles.actionCountText}> </AppText>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  navigationLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 2,
  },
  tapZone: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  progressBarContainer: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 2,
    overflow: "hidden",
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  inputSimulator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginRight: 16,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  actionButtonStack: {
    alignItems: "center",
    justifyContent: "flex-start",
    width: 44,
    minHeight: 58,
  },
  actionCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 14,
    minHeight: 14,
    textAlign: "center",
  },
});
