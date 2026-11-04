import { View } from "react-native";
import { Star } from "lucide-react-native";

import { AppSymbol } from "@/components/ui/AppSymbol";
import { useHungryTheme } from "@/theme";

/** Read-only stars for a review, one accessible element ("Rated 4 out of 5"). */
export function ReviewStars({ rating, size = 14 }: { rating: number; size?: number }) {
  const { palette } = useHungryTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Rated ${rating} out of 5`}
      style={{ alignItems: "center", flexDirection: "row", gap: 2 }}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <AppSymbol
          key={index}
          name={index < rating ? "star.fill" : "star"}
          fallback={Star}
          filled={index < rating}
          size={size}
          color={index < rating ? palette.starStroke : palette.border}
        />
      ))}
    </View>
  );
}
