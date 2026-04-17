import { useCallback } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useUIStore } from "@/store/useUIStore";

export function useScrollToRevealBack() {
  const registerScrollForBack = useUIStore((state) => state.registerScrollForBack);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      registerScrollForBack(event.nativeEvent.contentOffset.y);
    },
    [registerScrollForBack],
  );

  return {
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}
