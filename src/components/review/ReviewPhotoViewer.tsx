import { useRef, useState } from "react";
import { FlatList, Modal, Pressable, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage, AppText } from "../ui";

/** Photos sit on black in both themes. */
const VIEWER_BACKGROUND = "#000000";

type ReviewPhotoViewerProps = {
  /** Photos of one review. Mount the viewer to open it and unmount it on close. */
  photos: string[];
  /** Which photo to open on. */
  initialIndex?: number;
  /** Names what the photos belong to, for screen readers ("Char Kway Teow review"). */
  label: string;
  onClose: () => void;
};

/** Full-screen, swipeable view of every photo on a review. */
export function ReviewPhotoViewer({
  photos,
  initialIndex = 0,
  label,
  onClose,
}: ReviewPhotoViewerProps) {
  const { palette } = useHungryTheme();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string> | null>(null);

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: VIEWER_BACKGROUND }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <AppText variant="bodySmallBold" style={{ color: palette.white }}>
            {`${Math.min(index + 1, photos.length)} of ${photos.length}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photos"
            onPress={onClose}
            style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
          >
            <X color={palette.white} size={24} />
          </Pressable>
        </View>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, photoIndex) => `${photoIndex}:${uri}`}
          initialScrollIndex={Math.min(initialIndex, Math.max(photos.length - 1, 0))}
          getItemLayout={(_data, photoIndex) => ({
            length: width,
            offset: width * photoIndex,
            index: photoIndex,
          })}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))
          }
          renderItem={({ item, index: photoIndex }) => (
            <AccessibleImage
              source={{ uri: item }}
              accessibilityLabel={`${label}, photo ${photoIndex + 1} of ${photos.length}`}
              style={{ width, height: height * 0.8 }}
              contentFit="contain"
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
