import { Pressable, View } from "react-native";
import { FolderHeart, Plus } from "lucide-react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText } from "@/components/ui/AppText";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

type AlbumProps = {
  name: string;
  itemCount: number;
  /** Up to four dish photos for the cover mosaic. */
  coverPhotos: readonly string[];
  width: number;
  onPress: () => void;
};

export function collectionCountLabel(count: number): string {
  return count === 1 ? "1 saved" : `${count} saved`;
}

/** A collection (album) tile on the Saved page: a photo mosaic cover, its name and count. */
export function CollectionAlbumCard({ name, itemCount, coverPhotos, width, onPress }: AlbumProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const photos = coverPhotos.slice(0, 4);
  const cell = photos.length >= 4 ? width / 2 : width;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open collection ${name}, ${collectionCountLabel(itemCount)}`}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => ({
        gap: spacing[1.5],
        transform: [{ scale: pressed ? 0.97 : 1 }],
        width,
      })}
    >
      <View
        style={{
          backgroundColor: palette.orangeLight,
          borderRadius: componentRadii.card,
          flexDirection: "row",
          flexWrap: "wrap",
          height: width,
          overflow: "hidden",
          width,
        }}
      >
        {photos.length === 0 ? (
          <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
            <FolderHeart color={palette.orange} size={36} />
          </View>
        ) : (
          (photos.length >= 4 ? photos : photos.slice(0, 1)).map((uri) => (
            <AccessibleImage
              key={uri}
              source={{ uri }}
              decorative
              contentFit="cover"
              style={{ height: cell, width: cell }}
            />
          ))
        )}
      </View>
      <AppText variant="bodyBold" numberOfLines={1}>
        {name}
      </AppText>
      <AppText variant="micro" tone="muted">
        {collectionCountLabel(itemCount)}
      </AppText>
    </Pressable>
  );
}

/** The first tile in the collections grid: starts a new collection. */
export function NewCollectionTile({ width, onPress }: { width: number; onPress: () => void }) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New collection"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => ({
        gap: spacing[1.5],
        transform: [{ scale: pressed ? 0.97 : 1 }],
        width,
      })}
    >
      <View
        style={{
          alignItems: "center",
          borderColor: palette.orange,
          borderRadius: componentRadii.card,
          borderStyle: "dashed",
          borderWidth: 1.5,
          gap: spacing[2],
          height: width,
          justifyContent: "center",
          width,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orange,
            borderRadius: 999,
            height: 44,
            justifyContent: "center",
            width: 44,
          }}
        >
          <Plus color={palette.textOnOrange} size={22} />
        </View>
      </View>
      <AppText variant="bodyBold">New collection</AppText>
      <AppText variant="micro" tone="muted">
        Group dishes your way
      </AppText>
    </Pressable>
  );
}
