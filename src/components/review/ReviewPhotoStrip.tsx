import { ScrollView } from "react-native";

import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "../ui";

interface ReviewPhotoStripProps {
  photos: readonly string[];
  /** Names the photos for screen readers, e.g. the dish or the reviewer. */
  subject: string;
  size?: number;
}

/** A row of a review's photos (signed URLs from the reviews service). */
export function ReviewPhotoStrip({ photos, subject, size = 72 }: ReviewPhotoStripProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const urls = photos.filter((url) => url.trim().length > 0);
  if (urls.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing[2] }}
    >
      {urls.map((url, index) => (
        <AccessibleImage
          key={`${url}-${index}`}
          source={{ uri: url }}
          contentFit="cover"
          accessibilityLabel={`Photo ${index + 1} of ${urls.length}, ${subject}`}
          style={{
            backgroundColor: palette.surfaceRaised,
            borderRadius: radii.md,
            height: size,
            width: size,
          }}
        />
      ))}
    </ScrollView>
  );
}
