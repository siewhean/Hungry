import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

const DEFAULT_CYCLE_MS = 4000;
const AUTO_ADVANCE_SETTLE_MS = 520;

interface CyclingGridImageProps {
  images: string[];
  cycleMs?: number;
  isAutoCycleActive?: boolean;
  startDelayMs?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  fallbackImageSource?: ImageSourcePropType;
  onActiveIndexChange?: (index: number) => void;
  onActiveImageChange?: (imageUrl?: string) => void;
}

export function CyclingGridImage({
  images,
  cycleMs = DEFAULT_CYCLE_MS,
  isAutoCycleActive = true,
  startDelayMs = 0,
  style,
  accessibilityLabel = "Featured food image",
  fallbackImageSource,
  onActiveIndexChange,
  onActiveImageChange,
}: CyclingGridImageProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const containerRef = useRef<View | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const activeIndexRef = useRef(0);
  const isUserDraggingRef = useRef(false);
  const dragFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const imageSignature = images.join("\u001f");
  const safeImages = useMemo(
    () =>
      imageSignature
        .split("\u001f")
        .filter((image) => image.trim().length > 0 && !failedUrls.includes(image)),
    [failedUrls, imageSignature],
  );
  const activeImage = safeImages[activeIndex] ?? safeImages[0];

  useEffect(() => {
    onActiveIndexChangeRef.current = onActiveIndexChange;
  }, [onActiveIndexChange]);

  useEffect(() => {
    onActiveImageChange?.(activeImage);
  }, [activeImage, onActiveImageChange]);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const normalizedIndex = Math.max(0, Math.min(nextIndex, safeImages.length - 1));

      if (activeIndexRef.current === normalizedIndex) {
        return;
      }

      activeIndexRef.current = normalizedIndex;
      setActiveIndex(normalizedIndex);
      onActiveIndexChangeRef.current?.(normalizedIndex);
    },
    [safeImages.length],
  );

  useEffect(() => {
    setFailedUrls([]);
    activeIndexRef.current = 0;
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ animated: false, x: 0, y: 0 });
    onActiveIndexChangeRef.current?.(0);
  }, [imageSignature]);

  useEffect(() => {
    if (activeIndex >= safeImages.length && safeImages.length > 0) {
      commitIndex(0);
    }
  }, [activeIndex, commitIndex, safeImages.length]);

  const handleImageError = useCallback((imageUrl: string) => {
    setFailedUrls((current) => (current.includes(imageUrl) ? current : [...current, imageUrl]));
  }, []);

  const measureFullVisibility = useCallback((callback: (isFullyVisible: boolean) => void) => {
    const node = containerRef.current;
    if (!node) {
      callback(false);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get("window");
      const isFullyVisible =
        width > 0 &&
        height > 0 &&
        x >= 0 &&
        y >= 0 &&
        x + width <= window.width &&
        y + height <= window.height;

      callback(isFullyVisible);
    });
  }, []);

  useEffect(() => {
    if (!isAutoCycleActive || safeImages.length <= 1 || layoutWidth <= 0) {
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let settleTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let isMounted = true;

    const scheduleNext = (delayMs: number) => {
      timeoutId = setTimeout(() => {
        if (isUserDraggingRef.current) {
          scheduleNext(cycleMs);
          return;
        }

        measureFullVisibility((isFullyVisible) => {
          if (!isMounted) {
            return;
          }

          if (isFullyVisible) {
            const nextIndex = (activeIndexRef.current + 1) % safeImages.length;
            scrollRef.current?.scrollTo({
              animated: true,
              x: nextIndex * layoutWidth,
              y: 0,
            });
            settleTimeoutId = setTimeout(() => {
              if (isMounted) {
                commitIndex(nextIndex);
              }
            }, AUTO_ADVANCE_SETTLE_MS);
          }

          scheduleNext(cycleMs);
        });
      }, delayMs);
    };

    scheduleNext(cycleMs + startDelayMs);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (settleTimeoutId) clearTimeout(settleTimeoutId);
    };
  }, [
    commitIndex,
    cycleMs,
    isAutoCycleActive,
    layoutWidth,
    measureFullVisibility,
    safeImages.length,
    startDelayMs,
  ]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (dragFallbackTimeoutRef.current) {
        clearTimeout(dragFallbackTimeoutRef.current);
      }
      isUserDraggingRef.current = false;
      if (layoutWidth <= 0) {
        return;
      }

      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / layoutWidth);
      commitIndex(nextIndex);
    },
    [commitIndex, layoutWidth],
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) > 0.05) {
        if (dragFallbackTimeoutRef.current) {
          clearTimeout(dragFallbackTimeoutRef.current);
        }
        dragFallbackTimeoutRef.current = setTimeout(() => {
          isUserDraggingRef.current = false;
        }, AUTO_ADVANCE_SETTLE_MS);
        return;
      }

      isUserDraggingRef.current = false;
      handleScrollEnd(event);
    },
    [handleScrollEnd],
  );
  const handleScrollBeginDrag = useCallback(() => {
    if (dragFallbackTimeoutRef.current) {
      clearTimeout(dragFallbackTimeoutRef.current);
    }
    isUserDraggingRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      if (dragFallbackTimeoutRef.current) {
        clearTimeout(dragFallbackTimeoutRef.current);
      }
    };
  }, []);

  const handleLayoutWidth = useCallback((nextWidth: number) => {
    setLayoutWidth((currentWidth) => {
      if (Math.abs(currentWidth - nextWidth) < 1) {
        return currentWidth;
      }

      requestAnimationFrame(() => {
        if (nextWidth > 0) {
          scrollRef.current?.scrollTo({
            animated: false,
            x: activeIndexRef.current * nextWidth,
            y: 0,
          });
        }
      });

      return nextWidth;
    });
  }, []);

  if (!activeImage) {
    return fallbackImageSource ? (
      <View style={[styles.container, style]}>
        <AccessibleImage
          source={fallbackImageSource}
          accessibilityLabel={`${accessibilityLabel} representative image`}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View
          style={{
            backgroundColor: palette.imageLabelSurface,
            borderRadius: radii.pill,
            left: spacing[2],
            paddingHorizontal: spacing[1.5],
            paddingVertical: spacing[0.5],
            position: "absolute",
            top: spacing[12],
          }}
        >
          <AppText variant="micro" style={{ color: palette.textOnDark, fontWeight: "900" }}>
            REPRESENTATIVE
          </AppText>
        </View>
      </View>
    ) : (
      <View
        accessibilityLabel={`${accessibilityLabel} unavailable`}
        style={[styles.container, style]}
      />
    );
  }

  return (
    <View
      ref={containerRef}
      onLayout={(event) => handleLayoutWidth(event.nativeEvent.layout.width)}
      style={[styles.container, style]}
    >
      {safeImages.length > 1 && layoutWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          directionalLockEnabled
          nestedScrollEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          style={StyleSheet.absoluteFill}
        >
          {safeImages.map((imageUrl, index) => (
            <View key={`${imageUrl}-${index}`} style={{ width: layoutWidth, height: "100%" }}>
              <AccessibleImage
                source={{ uri: imageUrl }}
                accessibilityLabel={`${accessibilityLabel} ${index + 1} of ${safeImages.length}`}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                onError={() => handleImageError(imageUrl)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <AccessibleImage
          source={{ uri: activeImage }}
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => handleImageError(activeImage)}
        />
      )}
    </View>
  );
}

export const CYCLING_GRID_IMAGE_INTERVAL_MS = DEFAULT_CYCLE_MS;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
