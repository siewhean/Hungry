import { useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHungryTheme } from "@/theme";
import { AccessibleImage, AppText } from "../ui";

interface PhotoPagerProps {
  photos: readonly string[];
  width: number;
  height: number;
  /** Names the photos for screen readers, e.g. "Kopi Stall". */
  subject: string;
  /** Distance of the "2 / 5" count from the bottom edge, to clear any overlay. */
  countBottomOffset?: number;
  /** Placeholder blurhash for the first photo. */
  blurhash?: string;
  /** Drawn over the pager (gradients, overlays) without taking touches. */
  children?: ReactNode;
}

function pageIndex(event: NativeSyntheticEvent<NativeScrollEvent>, width: number) {
  return Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
}

/**
 * A swipeable photo pager with a count; a tap opens the photos full screen. A single
 * photo shows no count and a tap still opens it.
 */
export function PhotoPager({
  photos,
  width,
  height,
  subject,
  countBottomOffset,
  blurhash,
  children,
}: PhotoPagerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerScrollRef = useRef<ScrollView>(null);
  const urls = photos.filter((url) => url.trim().length > 0);
  if (urls.length === 0) return null;
  const count = urls.length;

  return (
    <View style={{ height, width }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(pageIndex(event, width))}
        scrollEnabled={count > 1}
      >
        {urls.map((url, position) => (
          <Pressable
            key={`${url}-${position}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${position + 1} of ${count}, ${subject}`}
            accessibilityHint="Opens the photo full screen"
            onPress={() => setViewerIndex(position)}
            style={{ height, width }}
          >
            <AccessibleImage
              source={{ uri: url }}
              contentFit="cover"
              style={{ height, width }}
              placeholder={position === 0 ? blurhash : undefined}
              accessibilityLabel={`${subject} photo ${position + 1}`}
            />
          </Pressable>
        ))}
      </ScrollView>
      <View
        pointerEvents="none"
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      >
        {children}
      </View>
      {count > 1 ? (
        <View
          accessible
          accessibilityLabel={`Photo ${index + 1} of ${count}`}
          pointerEvents="none"
          style={{
            backgroundColor: palette.detailImageBadgeSurface,
            borderRadius: radii.pill,
            bottom: countBottomOffset ?? spacing[3],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
            position: "absolute",
            right: spacing[3],
          }}
        >
          <AppText variant="micro" style={{ color: palette.white }}>
            {index + 1} / {count}
          </AppText>
        </View>
      ) : null}

      <Modal
        visible={viewerIndex !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerIndex(null)}
        onShow={() =>
          viewerScrollRef.current?.scrollTo({
            x: (viewerIndex ?? 0) * windowWidth,
            animated: false,
          })
        }
      >
        <View style={{ backgroundColor: palette.navy, flex: 1 }}>
          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * windowWidth, y: 0 }}
            onMomentumScrollEnd={(event) => {
              const next = pageIndex(event, windowWidth);
              setViewerIndex(next);
              setIndex(next);
            }}
          >
            {urls.map((url, position) => (
              <AccessibleImage
                key={`${url}-viewer-${position}`}
                source={{ uri: url }}
                contentFit="contain"
                style={{ height: windowHeight, width: windowWidth }}
                accessibilityLabel={`Photo ${position + 1} of ${count}, ${subject}`}
              />
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photos"
            onPress={() => setViewerIndex(null)}
            style={{
              alignItems: "center",
              backgroundColor: palette.detailImageBadgeSurface,
              borderRadius: radii.pill,
              height: 44,
              justifyContent: "center",
              position: "absolute",
              right: spacing[4],
              top: insets.top + spacing[2],
              width: 44,
            }}
          >
            <X color={palette.white} size={22} />
          </Pressable>
          {count > 1 && viewerIndex !== null ? (
            <View
              pointerEvents="none"
              style={{
                alignSelf: "center",
                bottom: insets.bottom + spacing[4],
                position: "absolute",
              }}
            >
              <AppText variant="bodySmall" style={{ color: palette.white }}>
                {viewerIndex + 1} / {count}
              </AppText>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
