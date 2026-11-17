/**
 * CollectionListScreen — grid of all public Hungry-curated collections.
 * Accessed from the Discover tab Collections section.
 */

import { useEffect, useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, EmptyState, Screen } from "@/components/ui";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { useCollectionStore } from "@/store/useCollectionStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { FoodCollection } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "CollectionList">;

export function CollectionListScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const collections = useCollectionStore((s) => s.collections);
  const loadCollections = useCollectionStore((s) => s.loadCollections);
  const profile = useProfileStore((s) => s.profile);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  const isLoaded = useCollectionStore((state) => state.isLoaded);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadError(null);
    void loadCollections().catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Please retry.");
    });
    return () => {
      active = false;
    };
  }, [loadCollections, retry]);

  function handlePress(collection: FoodCollection) {
    navigation.navigate("CollectionDetail", { collectionId: collection.id });
  }

  return (
    <Screen title="Collections" subtitle="Curated food lists for every occasion" scroll={false}>
      {loadError ? (
        <View>
          <AppText>{loadError}</AppText>
          <Button label="Retry" onPress={() => setRetry((value) => value + 1)} />
        </View>
      ) : !isLoaded ? (
        <AppText>Loading collections…</AppText>
      ) : collections.length === 0 ? (
        <EmptyState title="No collections yet" body="Check back soon for curated food lists." />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          numColumns={1}
          contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
          renderItem={({ item }) => (
            <Pressable onPress={() => handlePress(item)}>
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: 16,
                  borderWidth: 1,
                  overflow: "hidden",
                }}
              >
                <CollectionCard
                  collection={item}
                  userId={isAuthenticated ? profile.id : undefined}
                  onPress={() => handlePress(item)}
                />
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
