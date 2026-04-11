import { Pressable, StyleSheet, View } from "react-native";
import { Sparkles, Star } from "lucide-react-native";
import { Image } from "expo-image";

import type { DishDetail } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Button, Card } from "../ui";
import { MustOrderBadge } from "./MustOrderBadge";

interface DecideForMeCardProps {
  dish: DishDetail;
  matchScore: number;
  onOrder?: () => void;
  onReroll?: () => void;
  onDismiss?: () => void;
}

export function DecideForMeCard({ dish, matchScore, onOrder, onReroll, onDismiss }: DecideForMeCardProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Card style={{ gap: spacing[4] }}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Badge label="Decide for me" tone="orange" />
          <AppText variant="h2">{dish.name}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {dish.venueName} · {dish.unitNumber} · {dish.floor}
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Sparkles size={18} color={palette.orange} />
          <AppText variant="h2" tone="accent">
            {matchScore}%
          </AppText>
        </View>
      </View>

      <Image
        source={{ uri: dish.imageUrl }}
        style={{ borderRadius: radii.sm, height: 180, width: "100%" }}
        contentFit="cover"
        placeholder={dish.blurhash}
        transition={180}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
        <Badge 
          label={dish.rating.toFixed(1)} 
          tone="amber" 
          rightIcon={<Star color={palette.amber} fill={palette.amber} size={10} />} 
        />
        {dish.mustOrder ? <MustOrderBadge /> : null}
      </View>

      <View style={styles.actions}>
        <Button label="Order now" onPress={onOrder} disabled={!onOrder} />
        <View style={styles.secondaryRow}>
          <Button label="Try again" variant="secondary" fullWidth={false} onPress={onReroll} disabled={!onReroll} />
          <Pressable accessibilityRole="button" onPress={onDismiss} disabled={!onDismiss}>
            <AppText tone="accent">Dismiss</AppText>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  actions: {
    gap: 12,
  },
  secondaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
});
