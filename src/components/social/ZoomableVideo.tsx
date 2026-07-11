import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Pause, Volume2, VolumeX } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

const EDGE_FAST_FORWARD_FRACTION = 0.2;

type ZoomableVideoProps = {
  uri: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ZoomableVideo({ uri, accessibilityLabel, style }: ZoomableVideoProps) {
  const { componentRadii, palette } = useHungryTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [videoWidth, setVideoWidth] = useState(0);
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    player.loop = true;
  }, [player]);

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

  useEffect(() => {
    const replaySubscription = player.addListener("playToEnd", () => {
      if (!isPlaying) {
        return;
      }

      player.currentTime = 0;
      player.play();
    });

    return () => replaySubscription.remove();
  }, [isPlaying, player]);

  const handleTogglePlay = () => {
    setIsPlaying((current) => !current);
  };

  const handleToggleMute = () => {
    setIsMuted((current) => !current);
  };

  const startFastForward = (touchX: number) => {
    const leftEdge = videoWidth * EDGE_FAST_FORWARD_FRACTION;
    const rightEdge = videoWidth * (1 - EDGE_FAST_FORWARD_FRACTION);
    const isEdgeHold = videoWidth > 0 && (touchX <= leftEdge || touchX >= rightEdge);

    if (!isEdgeHold) {
      return;
    }

    player.playbackRate = 2.0;
    setIsFastForwarding(true);
  };

  const stopFastForward = () => {
    player.playbackRate = 1.0;
    setIsFastForwarding(false);
  };

  const videoLongPress = Gesture.LongPress()
    .minDuration(300)
    .onStart((event) => {
      runOnJS(startFastForward)(event.x);
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
    <View
      onLayout={(event) => {
        setVideoWidth(event.nativeEvent.layout.width);
      }}
      style={[styles.container, { backgroundColor: palette.mediaBackdrop }, style]}
    >
      <GestureDetector gesture={videoGestures}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? "Post video"}
          accessibilityHint="Double tap to pause or play. Long press the left or right edge to play at 2x speed."
          accessibilityValue={{ text: isPlaying ? "Playing" : "Paused" }}
          onAccessibilityTap={handleTogglePlay}
          onMagicTap={handleTogglePlay}
          style={StyleSheet.absoluteFill}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        </View>
      </GestureDetector>

      {!isPlaying ? (
        <View pointerEvents="none" style={styles.centerIcon}>
          <Pause color={palette.white} size={48} fill={palette.white} opacity={0.6} />
        </View>
      ) : null}

      {isFastForwarding ? (
        <View
          pointerEvents="none"
          style={[
            styles.fastForwardIndicator,
            { backgroundColor: palette.mediaScrim, borderRadius: componentRadii.button },
          ]}
        >
          <AppText variant="h3" style={{ color: palette.white, fontWeight: "900" }}>
            2x Speed
          </AppText>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
        accessibilityHint={isMuted ? "Turns on video sound" : "Turns off video sound"}
        accessibilityState={{ selected: !isMuted }}
        onPress={handleToggleMute}
        style={[
          styles.muteButton,
          { backgroundColor: palette.mediaScrimSoft, borderRadius: componentRadii.iconButton },
        ]}
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

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  centerIcon: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  fastForwardIndicator: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: "absolute",
    top: 40,
    zIndex: 10,
  },
  muteButton: {
    alignItems: "center",
    bottom: 12,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    width: 36,
    zIndex: 10,
  },
});
