import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage, AppText } from "../ui";
import { ReviewPhotoViewer } from "./ReviewPhotoViewer";

interface ReviewPhotoStripProps {
  photos: readonly string[];
  /** Names the photos for screen readers, e.g. the dish or the reviewer. */
  subject: string;
  size?: number;
  /** A title above the row ("Photos from reviews"). It goes with the row when no photo is left. */
  heading?: string;
}

/**
 * A row of a review's photos (signed URLs from the reviews service). Tapping one opens it full
 * screen, where the diner can swipe through the rest. A photo that fails to load (a dead link, a
 * bad connection) is dropped instead of left as a blank tile; with none left, the row and its
 * heading are gone.
 */
export function ReviewPhotoStrip({ photos, subject, size = 72, heading }: ReviewPhotoStripProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const urls = photos.filter((url) => url.trim().length > 0 && !failedUrls.has(url));
  if (urls.length === 0) return null;
  const dropFailedPhoto = (url: string) =>
    setFailedUrls((current) => (current.has(url) ? current : new Set(current).add(url)));
  const strip = (
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
              onError={() => dropFailedPhoto(url)}
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
  if (!heading) return strip;
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
        {heading}
      </AppText>
      {strip}
    </View>
  );
}
