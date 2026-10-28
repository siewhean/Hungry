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
import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";

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
  enableMovingPlaceholder?: boolean;
  movingPlaceholderPhrases?: string[];
  showExpandedBacking?: boolean;
  /** Stay open after a search is submitted, so the query can be edited without tapping the icon. */
  keepOpenWithQuery?: boolean;
};

export function ExpandableSearchLauncher({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  placeholder,
  expandedWidth,
  iconAlignment = "left",
  iconSize,
  barHeight,
  placeholderColor,
  borderColor,
  backgroundColor,
  textColor,
  style,
  inputStyle,
  onBlur,
  dismissOnTapAway = true,
  accessibilityLabel,
  enableMovingPlaceholder,
  movingPlaceholderPhrases,
  showExpandedBacking = true,
  keepOpenWithQuery = false,
}: ExpandableSearchLauncherProps) {
  const {
    componentCornerCurve,
    componentRadii,
    componentSizes,
    motion,
    palette,
    shadows,
    spacing,
    typography,
  } = useHungryTheme();
  const iconColor = palette.textMuted;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const resolvedIconSize = iconSize ?? componentSizes.searchIconSlot;
  const resolvedBarHeight = barHeight ?? componentSizes.searchBarHeight;
  const searchIconSlotWidth = resolvedIconSize;
  const shouldAnimatePlaceholder = enableMovingPlaceholder === true;
  const animatedPlaceholder = useMovingSearchPlaceholder({
    phrases: movingPlaceholderPhrases ?? [placeholder || "Search..."],
    enabled: shouldAnimatePlaceholder,
    tickMs: 2,
    revealStepMs: 2,
    deleteStepMs: 2,
    pauseMs: 280,
  });
  const placeholderText = shouldAnimatePlaceholder ? animatedPlaceholder : placeholder;
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
      duration: motion.searchExpand,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  }, [isSearchExpanded, motion.searchExpand, searchRevealProgress]);

  const hideSearch = useCallback(() => {
    if (!isSearchExpanded) return;
    Keyboard.dismiss();
    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: motion.searchCollapse,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
        onBlur?.();
      }),
    );
  }, [isSearchExpanded, motion.searchCollapse, onBlur, searchRevealProgress]);

  // Pressing clear blurs the input first; keep the bar open so one tap clears.
  const isClearingRef = useRef(false);
  const handleClearPressIn = useCallback(() => {
    isClearingRef.current = true;
  }, []);

  const handleClear = useCallback(() => {
    isClearingRef.current = false;
    onQueryChange("");
    onClear?.();
    searchInputRef.current?.focus();
  }, [onClear, onQueryChange]);

  const handleInputBlur = useCallback(() => {
    if (isClearingRef.current) return;
    if (keepOpenWithQuery && query.trim()) return;
    hideSearch();
  }, [hideSearch, keepOpenWithQuery, query]);

  const handleSubmit = useCallback(() => {
    if (keepOpenWithQuery && query.trim()) Keyboard.dismiss();
    else hideSearch();
    onSubmit();
  }, [hideSearch, keepOpenWithQuery, onSubmit, query]);

  const expandedAnchorStyle = { right: 0 };
  const launcherRowDirection = iconAlignment === "right" ? "row-reverse" : "row";
  const launcherAlignment =
    iconAlignment === "right" ? styles.alignLauncherRight : styles.alignLauncherLeft;
  const backingHeight = Math.max(resolvedBarHeight, componentSizes.headerMinHeight);
  const backingVerticalOffset = -(backingHeight - resolvedBarHeight) / 2;

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
          height: resolvedBarHeight,
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
            height: resolvedBarHeight,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: componentRadii.iconButton,
            borderCurve: componentCornerCurve.borderCurve,
          }}
        >
          <Search color={iconColor} size={20} />
        </Pressable>
      </Animated.View>

      {showExpandedBacking ? (
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
      ) : null}
      <Animated.View
        pointerEvents={isSearchExpanded ? "auto" : "none"}
        style={[
          styles.expandedInput,
          {
            right: 0,
            gap: spacing[2],
            zIndex: 40,
            width: launcherWidth,
            height: resolvedBarHeight,
            borderColor: borderColor ?? palette.textMuted,
            backgroundColor: backgroundColor ?? palette.surface,
            borderWidth: 1,
            borderRadius: componentRadii.search,
            borderCurve: componentCornerCurve.borderCurve,
            paddingHorizontal: spacing[4],
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
            placeholder={placeholderText}
            placeholderTextColor={placeholderColor ?? palette.textSecondary}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            returnKeyType="search"
            clearButtonMode="never"
            style={[
              styles.textInput,
              {
                height: resolvedBarHeight,
                fontFamily: typography.body.fontFamily,
                fontSize: typography.body.fontSize,
                color: textColor ?? palette.text,
              },
              inputStyle,
            ]}
            onSubmitEditing={handleSubmit}
            onBlur={handleInputBlur}
          />
        </Animated.View>
        <Animated.View style={{ opacity: searchInputOpacity }}>
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              accessibilityHint="Clears the current search query"
              hitSlop={8}
              onPressIn={handleClearPressIn}
              onPress={handleClear}
            >
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
    justifyContent: "flex-start",
  },
  textInput: {
    flex: 1,
    padding: 0,
    textAlignVertical: "center",
  },
});
