import React, { useState, useRef } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Pause, Volume2, VolumeX } from "lucide-react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface ZoomableMediaProps {
  uri: string;
  type: "image" | "video";
  onPress?: () => void;
  style?: any;
}

export function ZoomableMedia({ uri, type, onPress, style }: ZoomableMediaProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const videoRef = useRef<Video>(null);

  // Zoom logic
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      scale.value = e.scale;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: focalX.value },
      { translateY: focalY.value },
      { scale: scale.value },
      { translateX: -focalX.value },
      { translateY: -focalY.value },
    ],
  }));

  const handleTogglePlay = async () => {
    if (!videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  };

  const handleToggleMute = async () => {
    setIsMuted(!isMuted);
  };

  const videoLongPress = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      if (videoRef.current) {
        runOnJS(setIsFastForwarding)(true);
        videoRef.current.setRateAsync(2.0, true);
      }
    })
    .onEnd(() => {
      if (videoRef.current) {
        runOnJS(setIsFastForwarding)(false);
        videoRef.current.setRateAsync(1.0, true);
      }
    })
    .onFinalize(() => {
      if (videoRef.current) {
        runOnJS(setIsFastForwarding)(false);
        videoRef.current.setRateAsync(1.0, true);
      }
    });

  const videoTap = Gesture.Tap().onEnd((_event, success) => {
    if (success) {
      runOnJS(handleTogglePlay)();
    }
  });

  const videoGestures = Gesture.Exclusive(videoLongPress, videoTap);

  if (type === "video") {
    return (
      <View style={[styles.container, style]}>
        <GestureDetector gesture={videoGestures}>
          <View style={StyleSheet.absoluteFill}>
            <Video
              ref={videoRef}
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={isPlaying}
              isMuted={isMuted}
            />
          </View>
        </GestureDetector>

        {/* Play/Pause indicator */}
        {!isPlaying && (
          <View pointerEvents="none" style={styles.centerIcon}>
            <Pause color={palette.white} size={48} fill={palette.white} opacity={0.6} />
          </View>
        )}

        {/* 2x Fast Forward indicator */}
        {isFastForwarding && (
          <View pointerEvents="none" style={styles.fastForwardIndicator}>
            <AppText variant="h3" style={{ color: palette.white, fontWeight: "900" }}>2x Speed</AppText>
          </View>
        )}

        {/* Mute Button */}
        <Pressable onPress={handleToggleMute} style={styles.muteButton}>
          {isMuted ? (
            <VolumeX color={palette.white} size={20} />
          ) : (
            <Volume2 color={palette.white} size={20} />
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View style={[styles.container, style, animatedStyle]}>
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  centerIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  muteButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  fastForwardIndicator: {
    position: "absolute",
    top: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
});
