import { useState } from "react";
import { Pressable, ScrollView } from "react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "../ui";
import { ReviewPhotoViewer } from "./ReviewPhotoViewer";

interface ReviewPhotoStripProps {
  photos: readonly string[];
  /** Names the photos for screen readers, e.g. the dish or the reviewer. */
  subject: string;
  size?: number;
}

/**
 * A row of a review's photos (signed URLs from the reviews service). Tapping one opens it full
 * screen, where the diner can swipe through the rest.
 */
export function ReviewPhotoStrip({ photos, subject, size = 72 }: ReviewPhotoStripProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const urls = photos.filter((url) => url.trim().length > 0);
  if (urls.length === 0) return null;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2] }}
      >
        {urls.map((url, index) => (
          <Pressable
            key={`${url}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Photo ${index + 1} of ${urls.length}, ${subject}`}
            accessibilityHint="Opens the photo full screen"
            onPress={() => setViewerIndex(index)}
          >
            <AccessibleImage
              source={{ uri: url }}
              contentFit="cover"
              decorative
              style={{
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.md,
                height: size,
                width: size,
              }}
            />
          </Pressable>
        ))}
      </ScrollView>
      {viewerIndex !== null ? (
        <ReviewPhotoViewer
          photos={urls}
          initialIndex={viewerIndex}
          label={subject}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );
}
