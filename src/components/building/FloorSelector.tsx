import { useRef, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View, Animated } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

interface FloorSelectorProps {
  floors: string[];
  activeFloor: string;
  onFloorChange: (floor: string) => void;
}

/**
 * Underline tab-strip floor selector replacing Badge-chip pills.
 * Per Figma V2 Building Layout spec: active = orange underline + bold text,
 * inactive = grey text, no underline.
 */
export function FloorSelector({ floors, activeFloor, onFloorChange }: FloorSelectorProps) {
  const { palette, spacing, radii } = useHungryTheme();
  const underlineAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    underlineAnim.setValue(0);
    Animated.spring(underlineAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [activeFloor, underlineAnim]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { paddingHorizontal: spacing[4], gap: spacing[1] }]}
    >
      {floors.map((floor) => {
        const isActive = floor === activeFloor;
        return (
          <Pressable
            key={floor}
            onPress={() => onFloorChange(floor)}
            style={[
              styles.tab,
              {
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2.5],
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Floor ${floor}`}
          >
            <AppText
              variant={isActive ? "bodyBold" : "body"}
              style={{
                color: isActive ? palette.orange : palette.textMuted,
                fontSize: 15,
              }}
            >
              {floor}
            </AppText>
            {isActive && (
              <Animated.View
                style={[
                  styles.underline,
                  {
                    backgroundColor: palette.orange,
                    borderRadius: radii.sm,
                    opacity: underlineAnim,
                    transform: [
                      {
                        scaleX: underlineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    alignItems: "center",
    position: "relative",
  },
  underline: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 3,
  },
});
