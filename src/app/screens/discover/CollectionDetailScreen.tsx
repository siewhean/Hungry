/**
 * CollectionDetailScreen — stall list for a single collection.
 *
 * Shows cover image, description, then a list of stalls with
 * the user's save/tried interaction state for each.
 */

import { useEffect, useMemo, useState } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppText, EmptyState, IconButton, Skeleton } from "@/components/ui";
import { useCollectionStore } from "@/store/useCollectionStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import { trackCollectionViewed } from "@/lib/analytics/gamificationEvents";
import type { CollectionItem, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "CollectionDetail">;

interface StallRow {
  item: CollectionItem;
  venue?: VenueSummary;
}

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();

  const collections = useCollectionStore((state) => state.collections);
  const collection = useMemo(
    () => collections.find((item) => item.id === collectionId) ?? null,
    [collections, collectionId],
  );
  const loadCollections = useCollectionStore((s) => s.loadCollections);
  const loadItems = useCollectionStore((s) => s.loadCollectionItems);

  const interactions = useStallInteractionStore((s) => s.interactions);

  const [rows, setRows] = useState<StallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        await loadCollections();
        const items = await loadItems(collectionId);
        const repo = getDataRepository();
        const resolved: StallRow[] = items.map((item) => ({
          item,
          venue: repo.getVenueById(item.stallId),
        }));
        if (active) setRows(resolved);
      } catch (error) {
        // A failed load must not leave the skeleton up forever.
        if (active) setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [collectionId, loadCollections, loadItems]);

  // Track view after collection resolves
  useEffect(() => {
    if (collection) {
      trackCollectionViewed({ collectionId, createdBy: collection.createdBy });
    }
  }, [collectionId, collection?.createdBy]);

  const triedCount = rows.filter((r) => interactions[r.item.stallId]?.isTried).length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <View style={{ padding: spacing[4], gap: spacing[3] }}>
          <Skeleton width="100%" height={200} borderRadius={16} />
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="100%" height={80} borderRadius={12} />
          <Skeleton width="100%" height={80} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <EmptyState
          title="Couldn't load this collection"
          body="Check your connection and try again."
          errorMessage={loadError}
          sendErrorContext={`Collection ${collectionId}`}
          ctaLabel="Go back"
          onPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <EmptyState
          title="Collection not found"
          body="This collection may have been removed."
          errorMessage={`Unable to resolve collection ID ${collectionId}.`}
          sendErrorContext={`Collection ${collectionId}`}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Top nav overlay */}
      <View
        style={[
          styles.topNav,
          {
            paddingTop: insets.top + 4,
            paddingHorizontal: spacing[3],
          },
        ]}
      >
        <IconButton
          variant="floating"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          icon={<ChevronLeft color={palette.text} size={24} />}
        />
        <View style={{ flex: 1 }} />
        {/* Saving is hidden until saves persist to the account; it was memory-only. */}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
        ListHeaderComponent={
          <View>
            {/* Cover image */}
            {collection.coverImageUrl ? (
              <AccessibleImage
                source={{ uri: collection.coverImageUrl }}
                style={{ width: "100%", height: 220 }}
                contentFit="cover"
                accessibilityLabel={`Cover for ${collection.title}`}
              />
            ) : (
              <View style={{ width: "100%", height: 160, backgroundColor: palette.bgSoft }} />
            )}

            {/* Info block */}
            <View style={{ padding: spacing[4], gap: spacing[2] }}>
              <AppText variant="h1">{collection.title}</AppText>
              <AppText tone="muted" variant="bodySmall">
                {collection.description}
              </AppText>
              <AppText tone="muted" variant="micro">
                {collection.itemCount} places
                {rows.length > 0 && triedCount > 0 ? ` · ${triedCount} tried` : ""}
              </AppText>
            </View>
          </View>
        }
        renderItem={({ item: row }) => {
          const interaction = interactions[row.item.stallId];
          const isTried = interaction?.isTried ?? false;
          const isSavedStall = interaction?.isSaved ?? false;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.venue?.name ?? row.item.stallId} stall details`}
              accessibilityHint="Opens this stall page with menu and dish information"
              onPress={() => navigation.navigate("StallDetail", { venueId: row.item.stallId })}
              style={({ pressed }) => ({
                backgroundColor: pressed ? palette.bgSoft : "transparent",
                marginHorizontal: spacing[4],
                marginBottom: spacing[3],
              })}
            >
              <View
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    borderWidth: 1,
                    padding: spacing[4],
                    gap: spacing[1],
                  },
                ]}
              >
                {/* Order and name */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmall" tone="muted" style={{ marginBottom: 2 }}>
                      #{row.item.displayOrder + 1}
                    </AppText>
                    <AppText variant="bodyBold" numberOfLines={1}>
                      {row.venue?.name ?? row.item.stallId}
                    </AppText>
                  </View>
                  {/* Interaction indicators */}
                  <View style={{ flexDirection: "row", gap: spacing[2], marginLeft: spacing[2] }}>
                    {isSavedStall && (
                      <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
                        Saved
                      </AppText>
                    )}
                    {isTried && (
                      <AppText
                        variant="micro"
                        style={{ color: palette.statusFast, fontWeight: "700" }}
                      >
                        Tried ✓
                      </AppText>
                    )}
                  </View>
                </View>

                {/* Optional editorial note */}
                {row.item.note && (
                  <AppText tone="muted" variant="micro" numberOfLines={2}>
                    {row.item.note}
                  </AppText>
                )}

                {/* Floor/unit info */}
                {row.venue && (
                  <AppText tone="muted" variant="micro">
                    {row.venue.floor} · {row.venue.unitNumber}
                  </AppText>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: spacing[4] }}>
            <EmptyState title="No stalls yet" body="This collection is being updated." />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topNav: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
});
