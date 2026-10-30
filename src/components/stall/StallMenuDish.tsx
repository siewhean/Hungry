import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";

import { AccessibleImage, AppText } from "@/components/ui";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { isSoldOut } from "@/features/merchant/menuSections";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

/** The dish's own photos, deduplicated and sanitised: a menu tile never shows the stall's. */
export function getStallDishPhotos(dish: DishDetail) {
  // A menu tile only ever cycles the dish's own photos, so the image, name,
  // price and tap target always describe the same dish. URLs go through the
  // shared catalog sanitizer so unsafe or placeholder hosts fall back to NoDishPhoto.
  return Array.from(
    new Set(
      [dish.imageUrl, ...(dish.gallery ?? [])]
        .map((url) => sanitizeCatalogImageUrl(url))
        .filter((url): url is string => Boolean(url?.trim())),
    ),
  );
}

/**
 * Photo tiles need photos. When fewer than half of a stall's dishes have one (every dish in
 * production today), a grid of grey squares looks broken: list rows read as complete without
 * photos, as on foodpanda and GrabFood. Decided on the whole loaded menu, so filtering or
 * paging does not flip the layout.
 */
export function shouldUseMenuList(dishes: readonly DishDetail[]) {
  if (dishes.length === 0) return false;
  const withPhoto = dishes.filter((dish) => getStallDishPhotos(dish).length > 0).length;
  return withPhoto * 2 < dishes.length;
}

/** Screen-reader label for a menu tile: name, price or sold out. */
export function menuDishAccessibilityLabel(dish: DishDetail) {
  const status = isSoldOut(dish.availabilityFlags) ? "sold out today" : formatDishPrice(dish);
  return [dish.name, dish.mustOrder ? "must order" : null, status].filter(Boolean).join(", ");
}

type MenuDishProps = {
  dish: DishDetail;
  onPress: (dish: DishDetail) => void;
};

export function StallMenuDishCard({
  dish,
  onPress,
  width,
  isLeftColumn,
}: MenuDishProps & {
  width: number;
  /** The left tile draws the hairline between the two columns. */
  isLeftColumn: boolean;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  // One still photo per tile: no per-tile timers or measuring, and a swipe never fights the tap.
  const photo = useMemo(() => getStallDishPhotos(dish)[0], [dish]);
  const imageStyle = {
    width: "100%" as const,
    height: width * 0.7,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={menuDishAccessibilityLabel(dish)}
      accessibilityHint="Opens this dish detail page"
      onPress={() => onPress(dish)}
      // Square-cornered tiles that meet in the middle and run edge to edge.
      style={{
        width,
        backgroundColor: palette.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
        borderRightWidth: isLeftColumn ? StyleSheet.hairlineWidth : 0,
        overflow: "hidden",
      }}
    >
      <View>
        {photo ? (
          <AccessibleImage
            source={{ uri: photo }}
            accessibilityLabel={`${dish.name} photo`}
            style={imageStyle}
            contentFit="cover"
            placeholder={dish.blurhash}
            transition={180}
          />
        ) : (
          <NoDishPhoto dishName={dish.name} style={imageStyle} />
        )}
        {dish.mustOrder ? (
          <View
            style={{
              backgroundColor: palette.mediaScrim,
              borderRadius: radii.pill,
              left: spacing[2],
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
              position: "absolute",
              top: width * 0.7 - spacing[2] - 22,
            }}
          >
            <AppText
              variant="micro"
              style={{ color: palette.white, fontWeight: "800", letterSpacing: 0.5 }}
            >
              MUST ORDER
            </AppText>
          </View>
        ) : null}
        <View style={{ gap: spacing[1], padding: spacing[3] }}>
          <AppText variant="bodyBold" numberOfLines={2}>
            {dish.name}
          </AppText>
          {dish.description?.trim() ? (
            <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
              {dish.description}
            </AppText>
          ) : null}
          {/* Price on the left, rating on the right of the same row. */}
          <View
            style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
          >
            {isSoldOut(dish.availabilityFlags) ? (
              <AppText variant="bodySmallBold" style={{ color: palette.error }}>
                Sold out today
              </AppText>
            ) : (
              <AppText variant="price" style={{ color: palette.text }}>
                {formatDishPrice(dish)}
              </AppText>
            )}
            {dish.reviewCount > 0 ? (
              <AppText variant="micro" tone="secondary">
                <Text style={{ color: palette.starFill }}>★</Text> {dish.rating.toFixed(1)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Thumbnail size when a list row has a photo. */
const ROW_THUMBNAIL = 56;

/**
 * A full-width menu row: name and description on the left, price on the right, a small
 * photo only when the dish has one. Used when most of a menu has no photos.
 */
export function StallMenuDishRow({ dish, onPress }: MenuDishProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const photo = useMemo(() => getStallDishPhotos(dish)[0], [dish]);
  const soldOut = isSoldOut(dish.availabilityFlags);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={menuDishAccessibilityLabel(dish)}
      accessibilityHint="Opens this dish detail page"
      onPress={() => onPress(dish)}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.bgSoft : palette.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 64,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        width: "100%",
      })}
    >
      <View style={{ flex: 1, gap: spacing[0.5] }}>
        <AppText variant="bodyBold" numberOfLines={2}>
          {dish.name}
        </AppText>
        {dish.description?.trim() ? (
          <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
            {dish.description}
          </AppText>
        ) : null}
        {dish.mustOrder || dish.reviewCount > 0 ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            {dish.mustOrder ? (
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
                MUST ORDER
              </AppText>
            ) : null}
            {dish.reviewCount > 0 ? (
              <AppText variant="micro" tone="secondary">
                <Text style={{ color: palette.starFill }}>★</Text> {dish.rating.toFixed(1)}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      {soldOut ? (
        <AppText variant="bodySmallBold" style={{ color: palette.error }}>
          Sold out today
        </AppText>
      ) : (
        <AppText variant="price" style={{ color: palette.text }}>
          {formatDishPrice(dish)}
        </AppText>
      )}
      {photo ? (
        <AccessibleImage
          source={{ uri: photo }}
          accessibilityLabel={`${dish.name} photo`}
          style={{ borderRadius: radii.md, height: ROW_THUMBNAIL, width: ROW_THUMBNAIL }}
          contentFit="cover"
          placeholder={dish.blurhash}
          transition={180}
        />
      ) : null}
    </Pressable>
  );
}
