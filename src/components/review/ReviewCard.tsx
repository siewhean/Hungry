import { View } from "react-native";
import { Image } from "expo-image";

import type { Review } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Card } from "../ui";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const { palette, radii, spacing } = useHungryTheme();

  const initials = review.authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <AppText variant="bodySmall" style={{ color: palette.orange, fontFamily: "Nunito_700Bold" }}>
            {initials}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body">{review.authorName}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {review.createdAt}
          </AppText>
        </View>
      </View>
      <StarRating value={review.rating} />
      <AppText tone="secondary">{review.text}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {review.tags.map((tag) => (
          <Badge key={tag} label={tag} tone="neutral" />
        ))}
        <Badge label={review.wouldRecommend ? "Would recommend" : "Not recommended"} tone={review.wouldRecommend ? "success" : "warning"} />
      </View>
      {review.photos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {review.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ borderRadius: radii.sm, height: 72, width: 72 }} contentFit="cover" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

