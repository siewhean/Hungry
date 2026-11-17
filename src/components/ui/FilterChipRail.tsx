import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";

import { useHungryTheme } from "@/theme";
import { Chip } from "./Chip";

export type FilterChipRailOption<T extends string = string> = {
  id: T;
  label: string;
  leftIcon?: ReactNode;
  accessibilityLabel?: string;
};

interface FilterChipRailProps<T extends string = string> {
  options: readonly FilterChipRailOption<T>[];
  selectedId?: T;
  selectedIds?: readonly T[];
  onSelect: (id: T) => void;
  renderLeftIcon?: (option: FilterChipRailOption<T>, selected: boolean) => ReactNode;
  onSwipeLockChange?: (locked: boolean) => void;
  unlockDelayMs?: number;
  gap?: number;
  edgePadding?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  testID?: string;
}

const DEFAULT_UNLOCK_DELAY_MS = 320;

export function FilterChipRail<T extends string = string>({
  options,
  selectedId,
  selectedIds,
  onSelect,
  renderLeftIcon,
  onSwipeLockChange,
  unlockDelayMs = DEFAULT_UNLOCK_DELAY_MS,
  gap,
  edgePadding,
  style,
  contentContainerStyle,
  testID,
}: FilterChipRailProps<T>) {
  const { semanticSpacing, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockStateRef = useRef(false);
  const resolvedGap = gap ?? spacing[3];
  const resolvedEdgePadding = edgePadding ?? spacing[4];

  const clearUnlockTimer = useCallback(() => {
    if (!unlockTimerRef.current) {
      return;
    }

    clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = null;
  }, []);

  const setLocked = useCallback(
    (locked: boolean) => {
      if (lockStateRef.current === locked) {
        return;
      }

      lockStateRef.current = locked;
      onSwipeLockChange?.(locked);
    },
    [onSwipeLockChange],
  );

  const handleGestureStart = useCallback(() => {
    clearUnlockTimer();
    setLocked(true);
  }, [clearUnlockTimer, setLocked]);

  const handleGestureEnd = useCallback(() => {
    clearUnlockTimer();
    unlockTimerRef.current = setTimeout(() => {
      unlockTimerRef.current = null;
      setLocked(false);
    }, unlockDelayMs);
  }, [clearUnlockTimer, setLocked, unlockDelayMs]);

  useEffect(
    () => () => {
      clearUnlockTimer();
      if (lockStateRef.current) {
        onSwipeLockChange?.(false);
      }
    },
    [clearUnlockTimer, onSwipeLockChange],
  );

  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      testID={testID}
      style={[{ marginLeft: -semanticSpacing.screenEdge, width: screenWidth }, style]}
      contentContainerStyle={[
        { gap: resolvedGap, paddingHorizontal: resolvedEdgePadding },
        contentContainerStyle,
      ]}
      onTouchStart={handleGestureStart}
      onTouchEnd={handleGestureEnd}
      onTouchCancel={handleGestureEnd}
      onScrollBeginDrag={handleGestureStart}
      onScrollEndDrag={handleGestureEnd}
      onMomentumScrollEnd={handleGestureEnd}
    >
      {options.map((option) => {
        const selected =
          selectedId === option.id || Boolean(selectedIds?.some((id) => id === option.id));

        return (
          <Chip
            key={option.id}
            label={option.label}
            accessibilityLabel={option.accessibilityLabel}
            selected={selected}
            onPress={() => onSelect(option.id)}
            leftIcon={renderLeftIcon ? renderLeftIcon(option, selected) : option.leftIcon}
          />
        );
      })}
    </ScrollView>
  );
}
