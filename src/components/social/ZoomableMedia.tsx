import { StyleSheet, Pressable, type GestureResponderEvent } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

interface ZoomableMediaProps {
  uri: string;
  type: "image" | "video";
  onPress?: (event: GestureResponderEvent) => void;
  style?: any;
}

export function ZoomableMedia({ uri, type, onPress, style }: ZoomableMediaProps) {
  if (type === "video") {
    return <ZoomableVideoHost uri={uri} style={style} />;
  }

  return <ZoomableImage uri={uri} onPress={onPress} style={style} />;
}

function ZoomableVideoHost({ uri, style }: Pick<ZoomableMediaProps, "uri" | "style">) {
  const { ZoomableVideo } = require("./ZoomableVideo") as typeof import("./ZoomableVideo");
  return <ZoomableVideo uri={uri} style={style} />;
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
});
