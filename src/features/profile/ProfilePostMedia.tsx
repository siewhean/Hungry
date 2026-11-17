import { useState } from "react";
import { View } from "react-native";
import { ZoomableMedia } from "@/components/social";
import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** Explicit controls keep every photo reachable without a swipe gesture. */
export function ProfilePostMedia({
  urls,
  video,
  label,
}: {
  urls: string[];
  video: boolean;
  label: string;
}) {
  const { spacing, palette } = useHungryTheme();
  const [index, setIndex] = useState(0);
  const selected = Math.min(index, Math.max(0, urls.length - 1));
  return (
    <View style={{ flex: 1 }}>
      <ZoomableMedia
        uri={urls[selected]}
        type={video ? "video" : "image"}
        accessibilityLabel={`${label}, ${video ? "video" : `photo ${selected + 1} of ${urls.length}`}`}
        style={{ flex: 1, width: "100%", height: "100%" }}
      />
      {urls.length > 1 ? (
        <View
          style={{
            position: "absolute",
            bottom: spacing[3],
            left: spacing[3],
            right: spacing[3],
            backgroundColor: palette.surface,
            padding: spacing[2],
            gap: spacing[2],
          }}
        >
          <AppText accessibilityLiveRegion="polite">
            Photo {selected + 1} of {urls.length}
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Button
              variant="secondary"
              label="Previous photo"
              disabled={selected === 0}
              onPress={() => setIndex((value) => Math.max(0, value - 1))}
            />
            <Button
              variant="secondary"
              label="Next photo"
              disabled={selected === urls.length - 1}
              onPress={() => setIndex((value) => Math.min(urls.length - 1, value + 1))}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
