import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, ScrollView, View, type LayoutChangeEvent } from "react-native";

/** Points the row moves each second. */
const LOOP_SPEED = 28;

/**
 * A row of chips that drifts sideways by itself and loops without a gap. The content is drawn
 * twice and the row slides by one content width, so the second copy takes the first one's place.
 * A row that already fits stays put, and with reduced motion it is a plain scrolling row.
 */
export function LoopingRow({
  children,
  gap,
  reduceMotion = false,
  testID,
}: {
  children: ReactNode;
  gap: number;
  reduceMotion?: boolean;
  testID?: string;
}) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const overflows = contentWidth > viewportWidth && viewportWidth > 0;
  const shouldLoop = overflows && !reduceMotion;

  useEffect(() => {
    if (!shouldLoop) {
      offset.setValue(0);
      return undefined;
    }
    const distance = contentWidth + gap;
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -distance,
        duration: (distance / LOOP_SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [contentWidth, gap, offset, shouldLoop]);

  const measureViewport = (event: LayoutChangeEvent) =>
    setViewportWidth(event.nativeEvent.layout.width);
  const measureContent = (event: LayoutChangeEvent) =>
    setContentWidth(event.nativeEvent.layout.width);

  if (reduceMotion) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID={testID}
        contentContainerStyle={{ gap }}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View onLayout={measureViewport} style={{ overflow: "hidden" }} testID={testID}>
      <Animated.View
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          gap,
          transform: [{ translateX: offset }],
        }}
      >
        <View
          onLayout={measureContent}
          style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap }}
        >
          {children}
        </View>
        {shouldLoop ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap }}
          >
            {children}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
