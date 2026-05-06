import { useCallback, useRef, useState, useEffect } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Search, X } from "lucide-react-native";

import { useHungryTheme } from "@/theme";

export type SearchLauncherAlign = "left" | "right";

type ExpandableSearchLauncherProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  placeholder: string;
  expandedWidth: number;
  iconAlignment?: SearchLauncherAlign;
  iconSize?: number;
  barHeight?: number;
  onBlur?: () => void;
  placeholderColor?: string;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  dismissOnTapAway?: boolean;
  accessibilityLabel?: string;
};

export function ExpandableSearchLauncher({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  placeholder,
  expandedWidth,
  iconAlignment = "left",
  iconSize = 56,
  barHeight = 52,
  placeholderColor,
  borderColor,
  backgroundColor,
  textColor,
  style,
  inputStyle,
  onBlur,
  dismissOnTapAway = true,
  accessibilityLabel,
}: ExpandableSearchLauncherProps) {
  const { palette, shadows } = useHungryTheme();
  const iconColor = palette.textMuted;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchIconSlotWidth = iconSize;
  const searchInputOpacity = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const searchInputScale = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: "clamp",
  });

  useEffect(() => {
    return () => {
      searchRevealProgress.stopAnimation();
      searchRevealProgress.setValue(0);
    };
  }, [searchRevealProgress]);
  const launcherWidth = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [searchIconSlotWidth, expandedWidth],
    extrapolate: "clamp",
  });

  const revealSearch = useCallback(() => {
    if (isSearchExpanded) return;

    setIsSearchExpanded(true);
    searchRevealProgress.stopAnimation();
    searchRevealProgress.setValue(0);
    Animated.timing(searchRevealProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  }, [isSearchExpanded, searchRevealProgress]);

  const hideSearch = useCallback(() => {
    if (!isSearchExpanded) return;
    Keyboard.dismiss();
    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
        onBlur?.();
      }),
    );
  }, [isSearchExpanded, onBlur, searchRevealProgress]);

  const handleClear = useCallback(() => {
    onQueryChange("");
    onClear?.();
  }, [onClear, onQueryChange]);

  const handleSubmit = useCallback(() => {
    hideSearch();
    onSubmit();
  }, [hideSearch, onSubmit]);

  const expandedAnchorStyle = { right: 0 };
  const launcherRowDirection = iconAlignment === "right" ? "row-reverse" : "row";
  const launcherAlignment =
    iconAlignment === "right" ? styles.alignLauncherRight : styles.alignLauncherLeft;
  const backingHeight = Math.max(barHeight, 56);
  const backingVerticalOffset = -(backingHeight - barHeight) / 2;

  return (
    <View style={[launcherAlignment, { width: searchIconSlotWidth }, style]}>
      {isSearchExpanded && dismissOnTapAway ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={hideSearch}
          style={styles.tapAwayLayer}
        />
      ) : null}
      <Animated.View
        style={{
          width: launcherWidth,
          height: barHeight,
          alignItems: "center",
          justifyContent: "flex-start",
          flexDirection: launcherRowDirection,
          overflow: "hidden",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? placeholder}
          onPress={isSearchExpanded ? hideSearch : revealSearch}
          style={{
            width: searchIconSlotWidth,
            height: barHeight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search color={iconColor} size={20} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.expandedBacking,
          {
            right: 0,
            top: backingVerticalOffset,
            width: expandedWidth,
            height: backingHeight,
            opacity: searchInputOpacity,
            backgroundColor: palette.white,
          },
        ]}
      />
      <Animated.View
        pointerEvents={isSearchExpanded ? "auto" : "none"}
        style={[
          styles.expandedInput,
          {
            right: 0,
            zIndex: 40,
            width: launcherWidth,
            height: barHeight,
            borderColor: borderColor ?? palette.textMuted,
            backgroundColor: backgroundColor ?? palette.surface,
            borderWidth: 1,
            borderRadius: barHeight / 2,
            paddingHorizontal: 16,
          },
          iconAlignment === "right" ? styles.inputFromRight : null,
          expandedAnchorStyle,
          shadows.card,
          {
            opacity: searchInputOpacity,
            transform: [{ scaleX: searchInputScale }],
          },
        ]}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: searchInputOpacity,
            overflow: "hidden",
          }}
        >
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor ?? palette.textSecondary}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[
              styles.textInput,
              {
                height: barHeight,
                color: textColor ?? palette.text,
                fontSize: 15,
              },
              inputStyle,
            ]}
            onSubmitEditing={handleSubmit}
            onBlur={hideSearch}
          />
        </Animated.View>
        <Animated.View style={{ opacity: searchInputOpacity }}>
          {query.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={handleClear}>
              <X color={palette.textMuted} size={18} />
            </Pressable>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  alignLauncherLeft: {
    alignItems: "flex-start",
    position: "relative",
    zIndex: 30,
  },
  alignLauncherRight: {
    alignItems: "flex-end",
    position: "relative",
    zIndex: 30,
  },
  expandedInput: {
    position: "absolute",
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  expandedBacking: {
    position: "absolute",
    zIndex: 35,
  },
  tapAwayLayer: {
    position: "absolute",
    top: -1000,
    right: -1000,
    bottom: -1000,
    left: -1000,
    zIndex: 20,
  },
  inputFromRight: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  textInput: {
    flex: 1,
    fontFamily: "Nunito_400Regular",
    padding: 0,
    textAlignVertical: "center",
  },
});
