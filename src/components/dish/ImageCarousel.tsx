import type { ReactNode } from "react";
import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useHungryTheme } from "@/theme";

interface ImageCarouselProps {
  images: string[];
  width: number;
  height: number;
  children?: ReactNode;
}

export function ImageCarousel({ images, width, height, children }: ImageCarouselProps) {
  const { palette, radii } = useHungryTheme();
  const scrollX = useRef(new Animated.Value(0)).current;
  const indicatorDotSize = 7;
  const indicatorStep = 14;
  const indicatorTrackWidth = Math.max(
    indicatorDotSize,
    indicatorDotSize + Math.max(0, images.length - 1) * indicatorStep,
  );

  return (
    <View
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        snapToInterval={width}
        snapToAlignment="start"
        style={{ width, height: "100%" }}
      >
        {images.map((uri, index) => (
          <View key={`${uri}-${index}`} style={{ height: "100%", width }}>
            <Animated.View style={StyleSheet.absoluteFill}>
              <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Animated.View>
          </View>
        ))}
      </Animated.ScrollView>

      <LinearGradient
        colors={["transparent", palette.mediaGradientMid, palette.mediaScrimSoft]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {children}

      <View
        pointerEvents="none"
        style={{
          alignItems: "center",
          bottom: 12,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.mediaScrimSubtle,
            borderRadius: radii.pill,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <View
            style={{
              height: indicatorDotSize,
              position: "relative",
              width: indicatorTrackWidth,
            }}
          >
            {images.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={{
                  backgroundColor: palette.inverseIndicator,
                  borderRadius: radii.pill,
                  height: indicatorDotSize,
                  left: index * indicatorStep,
                  position: "absolute",
                  top: 0,
                  width: indicatorDotSize,
                }}
              />
            ))}
            <Animated.View
              style={{
                backgroundColor: palette.white,
                borderRadius: radii.pill,
                height: indicatorDotSize,
                left: 0,
                position: "absolute",
                top: 0,
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [0, Math.max(1, images.length - 1) * width],
                      outputRange: [0, Math.max(0, images.length - 1) * indicatorStep],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                width: indicatorDotSize,
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
