import { useEffect, useMemo, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import { getVenueLogoCandidates, getVenueLogoInitials } from "@/features/search/venueLogo";
import { useHungryTheme } from "@/theme";

interface StallLogoMarkProps {
  logoUrl?: string;
  name: string;
  size?: number;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function StallLogoMark({
  logoUrl,
  name,
  size = 64,
  borderWidth = 3,
  style,
}: StallLogoMarkProps) {
  const { palette, radii } = useHungryTheme();
  const candidates = useMemo(() => getVenueLogoCandidates(logoUrl), [logoUrl]);
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);
  const signature = candidates.join("\u001f");
  const activeLogoUrl = candidates.find((candidate) => !failedUrls.includes(candidate));
  // The logo fills the whole ring interior, so no circle background shows around it.
  const imageSize = Math.max(1, size - borderWidth * 2);

  useEffect(() => {
    setFailedUrls([]);
  }, [signature]);

  return (
    <View
      accessible={!activeLogoUrl}
      accessibilityLabel={!activeLogoUrl ? `${name} stall logo unavailable` : undefined}
      accessibilityRole={!activeLogoUrl ? "image" : undefined}
      style={[
        {
          alignItems: "center",
          backgroundColor: activeLogoUrl ? "transparent" : palette.surfaceRaised,
          borderColor: palette.orange,
          borderRadius: radii.pill,
          borderWidth,
          height: size,
          justifyContent: "center",
          overflow: "hidden",
          width: size,
        },
        style,
      ]}
    >
      {activeLogoUrl ? (
        <AccessibleImage
          key={activeLogoUrl}
          source={{ uri: activeLogoUrl }}
          accessibilityLabel={`${name} stall logo`}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          onError={() => {
            setFailedUrls((current) =>
              current.includes(activeLogoUrl) ? current : [...current, activeLogoUrl],
            );
          }}
          style={{ height: imageSize, width: imageSize }}
        />
      ) : (
        <AppText
          variant="bodySmallBold"
          tone="accent"
          allowFontScaling={false}
          style={{ fontSize: Math.max(14, size * 0.34), lineHeight: Math.max(18, size * 0.4) }}
        >
          {getVenueLogoInitials(name)}
        </AppText>
      )}
    </View>
  );
}
