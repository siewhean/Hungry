import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  Bookmark,
  CircleCheck,
  MapPin,
  Navigation,
  PenLine,
  Star,
  Store,
  Utensils,
} from "lucide-react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { savedDishPlaceLine } from "@/features/saved/savedDishes";
import type { SavedDishCard as SavedDish } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

export type SavedDishLayout = "card" | "row";

type Props = {
  dish: SavedDish;
  layout: SavedDishLayout;
  /** "450m away" once the position and the stall's point are both known. */
  distanceLabel?: string;
  tried: boolean;
  /** Only dishes on the Want to try tab can be un-saved from here. */
  canRemove: boolean;
  removing?: boolean;
  /** Absent when the stall has no name to search Google Maps by. */
  onDirections?: () => void;
  onOpen: () => void;
  onPressIn?: () => void;
  onRemove: () => void;
  onToggleTried: () => void;
  onReview: () => void;
};

/** The dish photo, or a plain placeholder when there is none or it fails to load. */
function DishPhoto({
  uri,
  size,
}: {
  uri?: string;
  size: { width: number | "100%"; height: number };
}) {
  const { palette } = useHungryTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View
        testID="saved-dish-photo-placeholder"
        style={{
          ...size,
          alignItems: "center",
          backgroundColor: palette.bgSoft,
          justifyContent: "center",
        }}
      >
        <Utensils color={palette.textMuted} size={size.height >= 120 ? 32 : 24} />
      </View>
    );
  }
  return (
    <AccessibleImage
      source={{ uri }}
      style={size}
      contentFit="cover"
      decorative
      onError={() => setFailed(true)}
    />
  );
}

/**
 * One saved dish, as a large photo card or a compact row. The same component serves the live
 * and the mock Saved page, so a diner never gets a thinner card than the design shows.
 */
export function SavedDishCard({
  dish,
  layout,
  distanceLabel,
  tried,
  canRemove,
  removing = false,
  onDirections,
  onOpen,
  onPressIn,
  onRemove,
  onToggleTried,
  onReview,
}: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const place = savedDishPlaceLine(dish);
  const stallLine = [dish.venueName, place].filter(Boolean).join(" · ");
  const hasRating = dish.rating !== undefined && (dish.reviewCount ?? 0) > 0;
  const openLabel = `Open ${dish.name}${dish.venueName ? ` at ${dish.venueName}` : ""}`;

  const removeButton = canRemove ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${dish.name} from Saved`}
      accessibilityState={{ busy: removing }}
      disabled={removing}
      hitSlop={6}
      onPress={onRemove}
      style={{
        alignItems: "center",
        backgroundColor: palette.surfaceTranslucent,
        borderRadius: componentRadii.iconButton,
        height: 44,
        justifyContent: "center",
        width: 44,
      }}
    >
      {removing ? (
        <ActivityIndicator color={palette.orange} />
      ) : (
        <Bookmark size={18} color={palette.orange} fill={palette.orange} />
      )}
    </Pressable>
  ) : null;

  const triedIcon = (
    <CircleCheck
      color={tried ? palette.success : palette.textSecondary}
      fill={tried ? palette.orangeLight : "none"}
      size={layout === "row" ? 20 : 15}
    />
  );
  const triedLabel = tried ? "Tried" : "Mark as tried";

  const details = (
    <View style={{ flex: layout === "row" ? 1 : undefined, gap: spacing[1.5] }}>
      <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "space-between" }}>
        <AppText
          variant={layout === "row" ? "bodyBold" : "h2"}
          style={{ flex: 1 }}
          numberOfLines={2}
        >
          {dish.name}
        </AppText>
        {dish.price !== undefined ? (
          <AppText variant="price" style={{ color: palette.text }}>
            S${dish.price.toFixed(2)}
          </AppText>
        ) : null}
      </View>
      {stallLine ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
          <Store color={palette.orange} size={15} />
          <AppText variant="bodySmall" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {stallLine}
          </AppText>
        </View>
      ) : null}
      {hasRating || distanceLabel ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          {hasRating ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <Star color={palette.starStroke} fill={palette.starFill} size={15} />
              <AppText variant="bodySmallBold">{dish.rating?.toFixed(1)}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                ({dish.reviewCount})
              </AppText>
            </View>
          ) : null}
          {distanceLabel ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <MapPin color={palette.textSecondary} size={15} />
              <AppText variant="bodySmall" tone="secondary">
                {distanceLabel}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (layout === "row") {
    return (
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[3],
          overflow: "hidden",
          padding: spacing[2],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          onPress={onOpen}
          onPressIn={onPressIn}
          style={{ borderRadius: componentRadii.card, overflow: "hidden" }}
        >
          <DishPhoto uri={dish.imageUrl} size={{ width: 96, height: 96 }} />
        </Pressable>
        <View style={{ flex: 1, gap: spacing[1] }}>
          {details}
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
            {onDirections ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Get directions to ${dish.venueName}`}
                hitSlop={6}
                onPress={onDirections}
                style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
              >
                <Navigation color={palette.orange} size={20} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={triedLabel}
              accessibilityState={{ checked: tried }}
              aria-checked={tried}
              hitSlop={6}
              onPress={onToggleTried}
              style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
            >
              {triedIcon}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Write a review of ${dish.name}`}
              hitSlop={6}
              onPress={onReview}
              style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
            >
              <PenLine color={palette.textSecondary} size={20} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {removeButton}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        overflow: "hidden",
      }}
    >
      <View style={{ height: 180, position: "relative" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          onPress={onOpen}
          onPressIn={onPressIn}
          style={{ height: "100%" }}
        >
          <DishPhoto uri={dish.imageUrl} size={{ width: "100%", height: 180 }} />
        </Pressable>
        {removeButton ? (
          <View style={{ position: "absolute", right: spacing[2], top: spacing[2] }}>
            {removeButton}
          </View>
        ) : null}
      </View>
      <View style={{ gap: spacing[3], padding: spacing[4] }}>
        {details}
        {onDirections ? (
          <Button
            label="Get directions"
            leftIcon={<Navigation size={18} color={palette.textOnOrange} />}
            onPress={onDirections}
          />
        ) : (
          <Button label="View dish" onPress={onOpen} />
        )}
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label={triedLabel}
            variant="secondary"
            size="sm"
            fullWidth={false}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: tried }}
            aria-checked={tried}
            leftIcon={triedIcon}
            onPress={onToggleTried}
            style={{ flex: 1 }}
          />
          <Button
            label="Write a review"
            variant="secondary"
            size="sm"
            fullWidth={false}
            leftIcon={<PenLine color={palette.textSecondary} size={15} />}
            onPress={onReview}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}
