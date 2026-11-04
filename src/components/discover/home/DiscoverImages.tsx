import { useEffect, useMemo, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { Utensils } from "lucide-react-native";

import { AccessibleImage } from "@/components/ui";
import { STALL_ROW_THUMBNAIL_SIZE } from "@/components/discover/home/homeLayout";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import type { VenueSummary } from "@/types/domain";

function DiscoverDishImagePlaceholder({
  accessibilityLabel,
  iconSize,
  style,
}: {
  accessibilityLabel: string;
  iconSize: number;
  style: StyleProp<ViewStyle>;
}) {
  const { palette } = useHungryTheme();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          alignItems: "center",
          backgroundColor: palette.bgSoft,
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Utensils color={palette.textMuted} size={Math.min(iconSize, 24)} />
    </View>
  );
}

export function DiscoverBiteImage({ bite, height }: { bite: Bite; height: number }) {
  const imageUrls = useMemo(
    () =>
      [bite.photoUrl, ...(bite.mediaUrls ?? [])].filter(
        (imageUrl, index, imageUrls) =>
          imageUrl.trim().length > 0 && imageUrls.indexOf(imageUrl) === index,
      ),
    [bite.mediaUrls, bite.photoUrl],
  );
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);
  const imageSignature = imageUrls.join("\u001f");
  const activeImageUrl = imageUrls.find((imageUrl) => !failedUrls.includes(imageUrl));

  useEffect(() => {
    setFailedUrls([]);
  }, [imageSignature]);

  if (activeImageUrl) {
    return (
      <AccessibleImage
        source={{ uri: activeImageUrl }}
        style={{ height, width: "100%" }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        onError={() => {
          setFailedUrls((current) =>
            current.includes(activeImageUrl) ? current : [...current, activeImageUrl],
          );
        }}
        decorative
      />
    );
  }

  return (
    <DiscoverDishImagePlaceholder
      accessibilityLabel={`${bite.dishName} photo unavailable`}
      iconSize={36}
      style={{ height, width: "100%" }}
    />
  );
}

export function DiscoverStallThumbnail({ venue }: { venue: VenueSummary }) {
  return (
    <StallLogoMark
      borderWidth={2}
      logoUrl={venue.logoUrl}
      name={venue.name}
      size={STALL_ROW_THUMBNAIL_SIZE}
    />
  );
}
