import { useEffect, useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Pause, Volume2, VolumeX } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
  if (type === "video") {
    return <ZoomableVideo uri={uri} style={style} />;
  }

  return <ZoomableImage uri={uri} onPress={onPress} style={style} />;
}

function ZoomableVideo({ uri, style }: Pick<ZoomableMediaProps, "uri" | "style">) {
  const { palette } = useHungryTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (isPlaying) {
      player.play();
      return;
    }

    player.pause();
  }, [isPlaying, player]);

  const handleTogglePlay = () => {
    setIsPlaying((current) => !current);
  };

  const handleToggleMute = () => {
    setIsMuted((current) => !current);
  };

  const startFastForward = () => {
    player.playbackRate = 2.0;
    setIsFastForwarding(true);
  };

  const stopFastForward = () => {
    player.playbackRate = 1.0;
    setIsFastForwarding(false);
  };

  const videoLongPress = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(startFastForward)();
    })
    .onEnd(() => {
      runOnJS(stopFastForward)();
    })
    .onFinalize(() => {
      runOnJS(stopFastForward)();
    });

  const videoTap = Gesture.Tap().onEnd((_event, success) => {
    if (success) {
      runOnJS(handleTogglePlay)();
    }
  });

  const videoGestures = Gesture.Exclusive(videoLongPress, videoTap);

  return (
    <View style={[styles.container, style]}>
      <GestureDetector gesture={videoGestures}>
        <View style={StyleSheet.absoluteFill}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
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
          <AppText variant="h3" style={{ color: palette.white, fontWeight: "900" }}>
            2x Speed
          </AppText>
        </View>
      )}

      {/* Mute Button */}
      <Pressable
        onPress={handleToggleMute}
        style={styles.muteButton}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
      >
        {isMuted ? (
          <VolumeX color={palette.white} size={20} />
        ) : (
          <Volume2 color={palette.white} size={20} />
        )}
      </Pressable>
    </View>
  );
}

function ZoomableImage({
  uri,
  onPress,
  style,
}: Pick<ZoomableMediaProps, "uri" | "onPress" | "style">) {
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
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
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
