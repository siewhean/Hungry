import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
} from "react-native";

import { RailScrollView } from "@/components/ui";
import { isNearRailEnd, nextRailCount, RAIL_PAGE_SIZE } from "@/features/discover/railPaging";

/**
 * A sideways row that opens on `initialCount` cards and shows the next page as the diner nears
 * the end. `resetKey` puts it back on its first cards (a chip or filter changed).
 */
export function PagedRailScrollView<T>({
  items,
  initialCount = RAIL_PAGE_SIZE,
  pageSize = RAIL_PAGE_SIZE,
  resetKey,
  renderItem,
  onScroll,
  ...scrollProps
}: Omit<ScrollViewProps, "children" | "horizontal"> & {
  items: readonly T[];
  initialCount?: number;
  pageSize?: number;
  resetKey?: string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const [shown, setShown] = useState(initialCount);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    setShown(initialCount);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [initialCount, resetKey]);
  const visible = useMemo(() => items.slice(0, shown), [items, shown]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll?.(event);
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (
        isNearRailEnd({
          offset: contentOffset.x,
          viewportWidth: layoutMeasurement.width,
          contentWidth: contentSize.width,
        })
      ) {
        setShown((count) =>
          count >= items.length ? count : nextRailCount(count, items.length, pageSize),
        );
      }
    },
    [items.length, onScroll, pageSize],
  );

  return (
    <RailScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={100}
      {...scrollProps}
      onScroll={handleScroll}
    >
      {visible.map(renderItem)}
    </RailScrollView>
  );
}
