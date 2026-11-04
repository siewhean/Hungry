import { View } from "react-native";

import { PassportStampArt } from "@/components/gamification/PassportStampArt";
import type { PassportStampDefinition } from "@/types/domain";

interface PassportStampBadgeProps {
  stamp: PassportStampDefinition;
  earned?: boolean;
  size?: "sm" | "md";
  /** Hide the level stars, for a caller that animates its own. */
  hideStars?: boolean;
}

/** A Passport stamp at one of the two standard sizes, labelled for screen readers. */
export function PassportStampBadge({
  stamp,
  earned = false,
  size = "md",
  hideStars = false,
}: PassportStampBadgeProps) {
  const side = size === "sm" ? 60 : 96;
  return (
    <View
      accessible
      accessibilityLabel={`${stamp.title} passport stamp${earned ? "" : ", locked"}`}
      style={{ height: side, width: side }}
    >
      <PassportStampArt
        categoryId={stamp.categoryId}
        level={stamp.index}
        earned={earned}
        size={side}
        hideStars={hideStars}
      />
    </View>
  );
}
