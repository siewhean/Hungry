import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  PanResponder,
  ActivityIndicator,
  InteractionManager,
  type LayoutChangeEvent,
} from "react-native";
import Reanimated, {
  cancelAnimation,
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Heart, Share2 } from "lucide-react-native";
import { AccessibleImage, AppText, IconButton, Avatar } from "@/components/ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useHungryTheme } from "@/theme";
import { useStoryStore } from "@/store/useStoryStore";
import { RootStackParamList } from "@/app/navigation/navigationTypes";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";

import { useUIStore } from "@/store/useUIStore";

const STORY_IMAGE_DURATION_MS = 7000;
const STORY_VIDEO_DURATION_MS = 7000;
const STORY_OPEN_READY_FALLBACK_MS = 850;
const STORY_SEEN_OPEN_FALLBACK_MS = 1400;
const STORY_MEDIA_READY_FALLBACK_MS = 1200;
const STORY_SEEN_COMMIT_DELAY_MS = 650;
const SWIPE_THRESHOLD = 48;
const STORY_ROTATE_ANGLE = 105;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

const StoryMedia = React.memo(function StoryMedia({
  storyId,
  uri,
  authorName,
  opacity,
  rotateY,
  onReady,
}: {
  storyId: string;
  uri: string;
  authorName: string;
  opacity: RNAnimated.Value;
  rotateY: RNAnimated.Value;
  onReady: (storyId: string) => void;
}) {
  const mediaRotateY = rotateY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`-${STORY_ROTATE_ANGLE}deg`, "0deg", `${STORY_ROTATE_ANGLE}deg`],
  });
  return (
    <RNAnimated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backfaceVisibility: "hidden",
          opacity,
          transform: [
            { perspective: 520 },
            { rotateY: mediaRotateY },
            {
              scale: rotateY.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0.9, 1, 0.9],
              }),
            },
          ],
        },
      ]}
    >
      <AccessibleImage
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel={`Story by ${authorName}`}
        onLoadEnd={() => onReady(storyId)}
      />
    </RNAnimated.View>
  );
});

function orderedStoriesFrom<T>(items: T[], startIndex: number): T[] {
  const safeStart = Math.max(startIndex, 0);
  return [...items.slice(safeStart), ...items.slice(0, safeStart)];
}

export function StoryViewerScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "StoryViewer">>();
  const initialStoryId = route.params.initialStoryId;

  const { stories, loadStories, likeStory, shareStory, markSeenForDisplayName } = useStoryStore();
  const showToast = useUIStore((state) => state.showToast);
  const [activeStoryId, setActiveStoryId] = useState(() => initialStoryId);
  const [isPaused, setIsPaused] = useState(false);
  const [hasRequestedStories, setHasRequestedStories] = useState(false);
  const [hasViewerOpened, setHasViewerOpened] = useState(false);
  const [hasViewerSettled, setHasViewerSettled] = useState(false);
  const [isCurrentMediaReady, setIsCurrentMediaReady] = useState(false);
  const [isActiveProgressTrackMeasured, setIsActiveProgressTrackMeasured] = useState(false);
  const [isStoryTransitioning, setIsStoryTransitioning] = useState(false);
  const [canCommitSeen, setCanCommitSeen] = useState(false);

  const progressAnim = useSharedValue(0);
  const progressTrackWidth = useSharedValue(0);
  const storyOpacity = useRef(new RNAnimated.Value(1)).current;
  const rotateY = useRef(new RNAnimated.Value(0)).current;
  const closeOpacity = useRef(new RNAnimated.Value(1)).current;
  const playbackStoryIdsRef = useRef<string[]>([]);
  const handleNextRef = useRef<() => void>(() => {});
  const isStoryTransitioningRef = useRef(false);

  const currentStory = stories.find((story) => story.id === activeStoryId);
  const playbackIndex = playbackStoryIdsRef.current.indexOf(activeStoryId);
  const isStoryPlaybackReady =
    hasViewerOpened &&
    isCurrentMediaReady &&
    isActiveProgressTrackMeasured &&
    !isStoryTransitioning;
  const currentStoryDuration = useMemo(
    () =>
      currentStory?.content.type === "video" ? STORY_VIDEO_DURATION_MS : STORY_IMAGE_DURATION_MS,
    [currentStory?.content.type],
  );

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
    cancelAnimation(progressAnim);
    progressAnim.value = 0;
    progressTrackWidth.value = 0;
    setIsActiveProgressTrackMeasured(false);
    closeOpacity.setValue(1);
    storyOpacity.setValue(1);
    rotateY.setValue(0);
  }, [closeOpacity, currentStory?.id, progressAnim, progressTrackWidth, rotateY, storyOpacity]);

  const startProgress = useCallback(
    (fromValue = progressAnim.value) => {
      const clampedValue = Math.min(Math.max(fromValue, 0), 1);
      cancelAnimation(progressAnim);
      progressAnim.value = clampedValue;
      if (reduceMotion) {
        progressAnim.value = 1;
        return;
      }
      progressAnim.value = withTiming(1, {
        duration: Math.max(0, (1 - clampedValue) * currentStoryDuration),
        easing: ReanimatedEasing.linear,
      });
    },
    [currentStoryDuration, progressAnim, reduceMotion],
  );

  const activeProgressStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(progressAnim.value, 0), 1);
    const trackWidth = progressTrackWidth.value;

    return {
      opacity: trackWidth > 0 ? 1 : 0,
      width: trackWidth * progress,
    };
  }, []);

  const handleActiveProgressTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      progressTrackWidth.value = event.nativeEvent.layout.width;
      setIsActiveProgressTrackMeasured(event.nativeEvent.layout.width > 0);
    },
    [progressTrackWidth],
  );

  const runRotateTransition = (nextId: string, direction: 1 | -1 = 1) => {
    if (isStoryTransitioningRef.current) {
      return;
    }
    isStoryTransitioningRef.current = true;
    setIsStoryTransitioning(true);
    cancelAnimation(progressAnim);
    rotateY.setValue(0);

    RNAnimated.timing(rotateY, {
      toValue: direction,
      duration: 320,
      useNativeDriver: true,
    }).start(() => {
      setActiveStoryId(nextId);
      rotateY.setValue(-direction);
      RNAnimated.timing(rotateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        isStoryTransitioningRef.current = false;
        setIsStoryTransitioning(false);
      });
    });
  };

  const closeWithFade = useCallback(() => {
    setIsPaused(true);
    RNAnimated.timing(closeOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  }, [closeOpacity, navigation]);

  const handlePrevious = useCallback(() => {
    if (!currentStory || isStoryTransitioningRef.current) return;
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
      runRotateTransition(prev.id, -1);
    } else {
      startProgress(0);
    }
  }, [currentStory, playbackIndex, startProgress, stories]);

  const commitSeenIfReady = useCallback(
    (displayName: string) => {
      if (isStoryPlaybackReady) {
        markSeenForDisplayName(displayName);
      }
    },
    [isStoryPlaybackReady, markSeenForDisplayName],
  );

  useEffect(() => {
    if (
      !currentStory ||
      currentStory.isOwn ||
      !currentStory.hasUnseen ||
      !isStoryPlaybackReady ||
      !hasViewerSettled ||
      !canCommitSeen
    ) {
      return;
    }

    markSeenForDisplayName(currentStory.displayName);
  }, [
    canCommitSeen,
    currentStory?.displayName,
    currentStory?.hasUnseen,
    currentStory?.isOwn,
    hasViewerSettled,
    isStoryPlaybackReady,
    markSeenForDisplayName,
  ]);

  const handleCloseStory = useCallback(() => {
    if (currentStory) {
      commitSeenIfReady(currentStory.displayName);
    }
    closeWithFade();
  }, [closeWithFade, commitSeenIfReady, currentStory]);

  const handleNext = useCallback(() => {
    if (!currentStory || isStoryTransitioningRef.current) return;
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

      commitSeenIfReady(currentStory.displayName);

      // Different user — fade stories to indicate a user change
      runRotateTransition(next.id, 1);
    } else {
      handleCloseStory();
    }
  }, [commitSeenIfReady, currentStory, handleCloseStory, playbackIndex, stories]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleProgressComplete = useCallback(() => {
    handleNextRef.current();
  }, []);

  useAnimatedReaction(
    () => progressAnim.value >= 1,
    (isComplete, wasComplete) => {
      if (isComplete && !wasComplete) {
        runOnJS(handleProgressComplete)();
      }
    },
    [handleProgressComplete],
  );

  useEffect(() => {
    if (!currentStory) return;
    if (isPaused || !isStoryPlaybackReady) {
      cancelAnimation(progressAnim);
      return;
    }
    startProgress(progressAnim.value);
    return () => cancelAnimation(progressAnim);
  }, [currentStory?.id, isPaused, isStoryPlaybackReady, progressAnim, startProgress]);

  useEffect(() => {
    let didMarkOpened = false;
    let didMarkSettled = false;
    let openedAnimationFrame: number | null = null;
    let settledAnimationFrame: number | null = null;
    let openedInteractionTask: { cancel?: () => void } | null = null;
    let settledInteractionTask: { cancel?: () => void } | null = null;
    const openFallbackTimeout = setTimeout(markOpened, STORY_OPEN_READY_FALLBACK_MS);
    const settledFallbackTimeout = setTimeout(markSettled, STORY_SEEN_OPEN_FALLBACK_MS);

    function markOpened() {
      if (didMarkOpened) {
        return;
      }
      didMarkOpened = true;
      openedAnimationFrame = requestAnimationFrame(() => {
        openedInteractionTask = InteractionManager.runAfterInteractions(() => {
          setHasViewerOpened(true);
        });
      });
    }

    function markSettled() {
      if (didMarkSettled) {
        return;
      }
      didMarkSettled = true;
      settledAnimationFrame = requestAnimationFrame(() => {
        settledInteractionTask = InteractionManager.runAfterInteractions(() => {
          setHasViewerSettled(true);
        });
      });
    }

    const unsubscribeTransitionEnd = navigation.addListener("transitionEnd", (event) => {
      const data = event.data as { closing?: boolean } | undefined;
      if (!data?.closing) {
        markOpened();
        markSettled();
      }
    });

    return () => {
      unsubscribeTransitionEnd();
      clearTimeout(openFallbackTimeout);
      clearTimeout(settledFallbackTimeout);
      if (openedAnimationFrame !== null) {
        cancelAnimationFrame(openedAnimationFrame);
      }
      if (settledAnimationFrame !== null) {
        cancelAnimationFrame(settledAnimationFrame);
      }
      openedInteractionTask?.cancel?.();
      settledInteractionTask?.cancel?.();
    };
  }, [navigation]);

  useEffect(() => {
    setIsCurrentMediaReady(false);
    const fallbackTimeout = setTimeout(() => {
      setIsCurrentMediaReady(true);
    }, STORY_MEDIA_READY_FALLBACK_MS);

    return () => clearTimeout(fallbackTimeout);
  }, [currentStory?.id]);

  const handleCurrentMediaReady = useCallback(
    (storyId: string) => {
      if (storyId === activeStoryId) {
        setIsCurrentMediaReady(true);
      }
    },
    [activeStoryId],
  );

  useEffect(() => {
    setCanCommitSeen(false);

    if (!currentStory || !isStoryPlaybackReady || !hasViewerSettled) {
      return undefined;
    }

    let animationFrame: number | null = null;
    let interactionTask: { cancel?: () => void } | null = null;
    const commitDelay = setTimeout(() => {
      animationFrame = requestAnimationFrame(() => {
        interactionTask = InteractionManager.runAfterInteractions(() => {
          setCanCommitSeen(true);
        });
      });
    }, STORY_SEEN_COMMIT_DELAY_MS);

    return () => {
      clearTimeout(commitDelay);
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      interactionTask?.cancel?.();
    };
  }, [currentStory?.id, hasViewerSettled, isStoryPlaybackReady]);

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
            handleCloseStory();
          }
        },
        onPanResponderTerminate: () => setIsPaused(false),
      }),
    [handleCloseStory, handleNext, handlePrevious],
  );

  const onLike = async () => {
    if (!currentStory) return;
    try {
      await likeStory(currentStory.id);
    } catch (e) {
      showToast({ message: "Failed to like story", tone: "error" });
    }
  };

  const onShare = async () => {
    if (!currentStory) return;
    try {
      await shareStory(currentStory.id);
      showToast({ message: "Story shared", tone: "success" });
    } catch (e) {
      showToast({ message: "Failed to share story", tone: "error" });
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

  if (!currentStory) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: palette.storyViewerBackground },
        ]}
      >
        <ActivityIndicator color={palette.white} />
      </View>
    );
  }

  return (
    <RNAnimated.View
      style={[
        styles.container,
        { backgroundColor: palette.storyViewerBackground, opacity: closeOpacity },
      ]}
    >
      <StoryMedia
        storyId={currentStory.id}
        uri={currentStory.content.url}
        authorName={currentStory.displayName}
        opacity={storyOpacity}
        rotateY={rotateY}
        onReady={handleCurrentMediaReady}
      />

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
              onLayout={idx === subIndex ? handleActiveProgressTrackLayout : undefined}
              style={[
                styles.progressBarTrack,
                { backgroundColor: palette.storyProgressTrack, borderRadius: radii.pill },
              ]}
            >
              {idx < subIndex && (
                <View
                  style={[
                    styles.progressBarFill,
                    { backgroundColor: palette.white, borderRadius: radii.pill, width: "100%" },
                  ]}
                />
              )}
              {idx === subIndex && (
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.progressBarFill,
                    activeProgressStyle,
                    {
                      backgroundColor: palette.white,
                      borderRadius: radii.pill,
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.userInfoRow} pointerEvents="box-none">
          <View
            style={[
              styles.userInfoLeftScrim,
              { backgroundColor: palette.mediaScrimSubtle, borderRadius: radii.md },
            ]}
            pointerEvents="none"
          >
            <View style={styles.userInfoLeft}>
              <Avatar uri={currentStory.avatarUrl} name={currentStory.displayName} size={32} />
              <AppText style={{ color: palette.white, fontWeight: "bold", marginLeft: 8 }}>
                {currentStory.displayName}
              </AppText>
              <AppText style={{ color: palette.storyMetaText, marginLeft: 8, fontSize: 12 }}>
                {formatTimeAgo(new Date(currentStory.createdAt))}
              </AppText>
            </View>
          </View>
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
          style={[styles.inputSimulator, { borderColor: palette.storyControlBorder }]}
          onPress={handleStoryMessage}
        >
          <AppText style={{ color: palette.white, width: "100%", textAlign: "left" }}>
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
            <AppText style={[styles.actionCountText, { color: palette.white }]}>
              {currentStory.interaction.likeCount > 0 ? currentStory.interaction.likeCount : " "}
            </AppText>
          </View>

          <View style={styles.actionButtonStack}>
            <IconButton
              icon={<Share2 color={palette.white} size={28} />}
              onPress={onShare}
              accessibilityLabel="Share story"
            />
            <AppText style={[styles.actionCountText, { color: palette.white }]}>
              {currentStory.interaction.shareCount > 0 ? currentStory.interaction.shareCount : " "}
            </AppText>
          </View>
        </View>
      </View>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
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
  progressBarFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    top: 0,
    width: "100%",
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
  userInfoLeftScrim: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "flex-start",
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
    fontSize: 10,
    lineHeight: 14,
    minHeight: 14,
    textAlign: "center",
  },
});
