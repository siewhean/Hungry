import { Pressable, View } from "react-native";
import { Star } from "lucide-react-native";

import { useHungryTheme } from "@/theme";

interface ReviewStarsProps {
  value: number;
  onChange: (value: number) => void;
}

export function ReviewStars({ value, onChange }: ReviewStarsProps) {
  const { palette, spacing } = useHungryTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing[2] }}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index + 1 <= value;

        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1} star`}
            onPress={() => onChange(index + 1)}
            style={{ alignItems: "center", justifyContent: "center", width: 44, height: 44 }}
          >
            <Star size={28} color={filled ? palette.amber : palette.border} fill={filled ? palette.amber : "transparent"} />
          </Pressable>
        );
      })}
    </View>
  );
}
