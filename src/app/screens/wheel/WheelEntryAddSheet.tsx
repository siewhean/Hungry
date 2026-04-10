/**
 * WheelEntryAddSheet
 *
 * Bottom-sheet with 4 tabs for adding wheel entries:
 *   1. Search — text search → venue results
 *   2. Random — "Surprise me" from nearby popular venues
 *   3. Category — browse by SearchCategory chips
 *   4. Favourites — from profile favourite dish IDs
 */

import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import { X } from "lucide-react-native";
import { Image } from "expo-image";

import { AppText, Badge, Card, Input } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory, VenueSummary } from "@/types/domain";

const CATEGORIES: SearchCategory[] = [
  "local favourites",
  "noodles",
  "rice",
  "desserts",
  "late night",
];

type Tab = "search" | "random" | "category" | "favourites";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function VenueRow({
  venue,
  onAdd,
}: {
  venue: VenueSummary;
  onAdd: () => void;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const dishes = mockRepository.listDishesByVenue(venue.id);
  const hero = dishes[0];

  return (
    <Pressable
      onPress={onAdd}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[3],
        padding: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      {hero?.imageUrl ? (
        <Image
          source={{ uri: hero.imageUrl }}
          style={{ width: 48, height: 48, borderRadius: radii.sm }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: palette.bgSoft,
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="h3">{venue.name}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {venue.floor} {venue.unitNumber}
        </AppText>
      </View>
      <Badge label="Add" tone="orange" />
    </Pressable>
  );
}

export function WheelEntryAddSheet({ visible, onClose }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const addEntry = useWheelStore((s) => s.addEntry);
  const entries = useWheelStore((s) => s.entries);
  const profile = useProfileStore((s) => s.profile);

  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);

  const addedVenueIds = new Set(entries.map((e) => e.venueId));

  function addVenue(venue: VenueSummary) {
    const dishes = mockRepository.listDishesByVenue(venue.id);
    addEntry(
      venue.id,
      venue.buildingId,
      venue.name,
      dishes[0]?.imageUrl ?? ""
    );
    onClose();
  }

  function addRandom() {
    const all = mockRepository
      .listBuildings()
      .flatMap((b) => mockRepository.listVenuesByBuilding(b.id))
      .filter((v) => !addedVenueIds.has(v.id));
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    addVenue(pick);
  }

  // ── Venue list for search + category ─────────────────────────────────────

  const allVenues = mockRepository
    .listBuildings()
    .flatMap((b) =>
      mockRepository.listVenuesByBuilding(b.id).map((v) => ({ ...v, buildingId: b.id }))
    );

  const searchResults =
    tab === "search" && query.trim()
      ? allVenues.filter((v) =>
          v.name.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  const categoryResults =
    tab === "category" && selectedCategory
      ? allVenues.filter((v) => {
          const dishes = mockRepository.listDishesByVenue(v.id);
          return dishes.some((d) => d.tasteTags.includes(selectedCategory));
        })
      : [];

  const favouriteVenues =
    tab === "favourites" && profile
      ? profile.favouriteDishIds
          .map((dishId) => mockRepository.getDishById(dishId))
          .filter(Boolean)
          .map((dish) => allVenues.find((v) => v.id === dish!.venueId))
          .filter((v): v is (typeof allVenues)[0] => v !== undefined)
          .filter(
            (v, i, arr) => arr.findIndex((x) => x.id === v.id) === i // dedupe
          )
      : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "search", label: "Search" },
    { id: "random", label: "Random" },
    { id: "category", label: "Category" },
    { id: "favourites", label: "Favourites" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: palette.overlay }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          maxHeight: "75%",
          ...shadows.floating,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
          }}
        >
          <AppText variant="h3">Add an option</AppText>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[2],
          }}
        >
          {tabs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: radii.pill,
                backgroundColor: tab === t.id ? palette.orange : palette.bgSoft,
                borderWidth: 1,
                borderColor: tab === t.id ? palette.orangeDark : palette.border,
              }}
            >
              <AppText
                variant="bodySmall"
                style={{ color: tab === t.id ? "#FFFFFF" : palette.text }}
              >
                {t.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {tab === "search" && (
            <>
              <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[3] }}>
                <Input
                  label=""
                  placeholder="Search for a stall…"
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
              </View>
              <FlatList
                data={searchResults}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <VenueRow venue={item} onAdd={() => addVenue(item)} />
                )}
                ListEmptyComponent={
                  query.trim() ? (
                    <AppText
                      tone="secondary"
                      style={{ textAlign: "center", padding: spacing[6] }}
                    >
                      No stalls found for "{query}"
                    </AppText>
                  ) : (
                    <AppText
                      tone="secondary"
                      style={{ textAlign: "center", padding: spacing[6] }}
                    >
                      Type to search for a stall.
                    </AppText>
                  )
                }
              />
            </>
          )}

          {tab === "random" && (
            <View style={{ padding: spacing[6], gap: spacing[4], alignItems: "center" }}>
              <AppText style={{ textAlign: "center" }} tone="secondary">
                Can't decide? Let us pick a random nearby stall for you.
              </AppText>
              <Pressable
                onPress={addRandom}
                style={{
                  backgroundColor: palette.orange,
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: radii.pill,
                }}
              >
                <AppText style={{ color: "#FFFFFF", fontFamily: "Nunito_700Bold" }}>
                  Surprise me!
                </AppText>
              </Pressable>
            </View>
          )}

          {tab === "category" && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing[4],
                  paddingBottom: spacing[3],
                  gap: spacing[2],
                }}
              >
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: radii.pill,
                      backgroundColor:
                        selectedCategory === cat ? palette.orange : palette.bgSoft,
                      borderWidth: 1,
                      borderColor:
                        selectedCategory === cat ? palette.orangeDark : palette.border,
                    }}
                  >
                    <AppText
                      variant="bodySmall"
                      style={{
                        color: selectedCategory === cat ? "#FFFFFF" : palette.text,
                        textTransform: "capitalize",
                      }}
                    >
                      {cat}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <FlatList
                data={categoryResults}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <VenueRow venue={item} onAdd={() => addVenue(item)} />
                )}
                ListEmptyComponent={
                  <AppText
                    tone="secondary"
                    style={{ textAlign: "center", padding: spacing[6] }}
                  >
                    {selectedCategory
                      ? "No stalls in this category."
                      : "Pick a category above."}
                  </AppText>
                }
              />
            </>
          )}

          {tab === "favourites" && (
            <FlatList
              data={favouriteVenues}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <VenueRow venue={item} onAdd={() => addVenue(item)} />
              )}
              ListEmptyComponent={
                <AppText
                  tone="secondary"
                  style={{ textAlign: "center", padding: spacing[6] }}
                >
                  No favourites yet. Heart some dishes first!
                </AppText>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
