/**
 * CollectionCard — horizontal card for the Discover collections carousel.
 * Shows cover image, title, stall count, and save state.
 */

import { View, Pressable, StyleSheet } from "react-native";
import { Bookmark, BookmarkCheck } from "lucide-react-native";
import { useMemo } from "react";

import { useHungryTheme } from "@/theme";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText } from "@/components/ui/AppText";
import { useCollectionStore } from "@/store/useCollectionStore";
import type { FoodCollection } from "@/types/domain";

interface CollectionCardProps {
  collection: FoodCollection;
  userId?: string;
  onPress?: () => void;
}

const CARD_WIDTH = 220;
const CARD_IMAGE_HEIGHT = 120;

export function CollectionCard({ collection, userId, onPress }: CollectionCardProps) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const savedCollectionIds = useCollectionStore((state) => state.savedCollectionIds);
  const isSaved = useMemo(
    () => savedCollectionIds.has(collection.id),
    [collection.id, savedCollectionIds],
  );
  const toggleSave = useCollectionStore((s) => s.toggleSaveCollection);

  function handleSave() {
    if (!userId) return;
    toggleSave(userId, collection.id);
  }

  const SaveIcon = isSaved ? BookmarkCheck : Bookmark;

  return (
    <Pressable
      accessibilityLabel={collection.title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        shadows.card,
        {
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          overflow: "hidden",
          width: CARD_WIDTH,
        },
      ]}
    >
      {/* Cover image */}
      {collection.coverImageUrl ? (
        <AccessibleImage
          source={{ uri: collection.coverImageUrl }}
          style={[styles.image, { height: CARD_IMAGE_HEIGHT }]}
          contentFit="cover"
          decorative
        />
      ) : (
        <View
          style={[styles.image, { height: CARD_IMAGE_HEIGHT, backgroundColor: palette.bgSoft }]}
        />
      )}

      {/* Content */}
      <View style={{ padding: spacing[3] }}>
        <View style={[styles.row, { justifyContent: "space-between", marginBottom: spacing[1] }]}>
          <AppText
            variant="bodySmallBold"
            style={{ flex: 1, marginRight: spacing[2] }}
            numberOfLines={1}
          >
            {collection.title}
          </AppText>
          <Pressable
            accessibilityLabel={isSaved ? "Unsave collection" : "Save collection"}
            accessibilityRole="button"
            onPress={handleSave}
            hitSlop={8}
          >
            <SaveIcon
              size={18}
              color={isSaved ? palette.orange : palette.textMuted}
              fill={isSaved ? palette.orange : "none"}
            />
          </Pressable>
        </View>
        <AppText
          tone="muted"
          variant="micro"
          numberOfLines={2}
          style={{ marginBottom: spacing[2] }}
        >
          {collection.description}
        </AppText>
        <AppText tone="muted" variant="micro">
          {collection.itemCount} places
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
