/**
 * WheelEntryAddSheet
 *
 * Bottom-sheet with 4 tabs for adding wheel entries:
 *   1. Search — text search → venue results
 *   2. Random — "Surprise me" from nearby popular venues
 *   3. Category — browse by SearchCategory chips
 *   4. Favourites — from profile favourite dish IDs
 */

import { useState, useMemo } from "react";
import { FlatList, Modal, Pressable, ScrollView, View, Alert } from "react-native";
import { X, Search, Compass, Heart, Plus, ShieldAlert, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AccessibleImage, AppText, Badge, Card, EmptyState, Input } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory, VenueSummary, DishDetail } from "@/types/domain";

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

function calculateMatchScore(dish: DishDetail | undefined, userTaste: any): number {
  if (!dish || !userTaste) return 0;
  let score = 0;
  const keys = Object.keys(userTaste) as (keyof typeof userTaste)[];
  keys.forEach((key) => {
    const dishVal = (dish.tasteVector as any)[key] || 0;
    const userVal = userTaste[key] || 0;
    score += dishVal * userVal;
  });
  return score;
}

function VenueRow({
  venue,
  onAdd,
  matchScore = 0,
}: {
  venue: VenueSummary;
  onAdd: () => void;
  matchScore?: number;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const repository = getDataRepository();
  const dishes = repository.listDishesByVenue(venue.id);
  const hero = dishes[0];
  const isHighMatch = matchScore > 120;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${venue.name} to wheel`}
      onPress={onAdd}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[3],
          padding: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        {hero?.imageUrl ? (
          <AccessibleImage
            source={{ uri: hero.imageUrl }}
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.md,
              borderWidth: isHighMatch ? 2 : 0,
              borderColor: palette.orange,
            }}
            contentFit="cover"
            accessibilityLabel={`${hero.name} photo`}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.md,
              backgroundColor: palette.bgSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={20} color={palette.textMuted} />
          </View>
        )}
        {isHighMatch && (
          <View
            style={{
              position: "absolute",
              top: -6,
              left: -6,
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              width: 20,
              height: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: palette.surface,
            }}
          >
            <Sparkles size={10} color={palette.textOnPrimary} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: spacing[1] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
          }}
        >
          <AppText style={{ fontWeight: "700", fontSize: 16 }}>{venue.name}</AppText>
          {isHighMatch && <Badge label="BEST MATCH" tone="orange" />}
        </View>
        <AppText variant="micro" tone="secondary">
          {venue.floor} {venue.unitNumber} • {hero?.tasteTags.slice(0, 2).join(", ")}
        </AppText>
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.pill,
          backgroundColor: palette.orangeLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={16} color={palette.orange} />
      </View>
    </Pressable>
  );
}

export function WheelEntryAddSheet({ visible, onClose }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const addEntry = useWheelStore((s) => s.addEntry);
  const entries = useWheelStore((s) => s.entries);
  const members = useWheelStore((s) => s.members);
  const profile = useProfileStore((s) => s.profile);
  const repository = getDataRepository();

  // Group dietary summary
  const groupDietaryRestrictions = useMemo(() => {
    const all = new Set<string>();
    members.forEach((m) => m.dietaryPreferences?.forEach((p) => all.add(p)));
    return Array.from(all);
  }, [members]);

  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);

  const addedVenueIds = new Set(entries.map((e) => e.venueId));

  function addVenue(venue: VenueSummary) {
    const dishes = repository.listDishesByVenue(venue.id);
    const venueDish = dishes[0];

    // Conflict detection
    if (groupDietaryRestrictions.length > 0 && venueDish) {
      const conflicts = groupDietaryRestrictions.filter(
        (pref) => !venueDish.dietaryFlags.includes(pref as any),
      );

      if (conflicts.length > 0) {
        Alert.alert(
          "Dietary Warning",
          `This stall may not accommodate: ${conflicts.join(", ")}. Someone in your party has these restrictions. Add anyway?`,
          [
            { text: "Pick Something Else", style: "cancel" },
            {
              text: "Add Anyway",
              onPress: () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                addEntry(venue.id, venue.buildingId, venue.name, venueDish.imageUrl ?? "");
                onClose();
              },
            },
          ],
        );
        return;
      }
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEntry(venue.id, venue.buildingId, venue.name, venueDish?.imageUrl ?? "");
    onClose();
  }

  function addRandom() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const all = repository
      .listBuildings()
      .flatMap((b) => repository.listVenuesByBuilding(b.id))
      .filter((v) => !addedVenueIds.has(v.id));
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    addVenue(pick);
  }

  // ── Venue list for search + category ─────────────────────────────────────

  const allVenues = useMemo(() => {
    return repository
      .listBuildings()
      .flatMap((b) =>
        repository.listVenuesByBuilding(b.id).map((v) => ({
          ...v,
          buildingId: b.id,
          matchScore: calculateMatchScore(
            repository.listDishesByVenue(v.id)[0],
            profile.tasteVector,
          ),
        })),
      )
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [profile.tasteVector, repository]);

  const searchResults = useMemo(
    () =>
      tab === "search" && query.trim()
        ? allVenues.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
        : [],
    [allVenues, tab, query],
  );

  const categoryResults = useMemo(
    () =>
      tab === "category" && selectedCategory
        ? allVenues.filter((v) => {
            const dishes = repository.listDishesByVenue(v.id);
            return dishes.some((d) => d.tasteTags.includes(selectedCategory));
          })
        : [],
    [allVenues, tab, selectedCategory, repository],
  );

  const favouriteVenues = useMemo(
    () =>
      tab === "favourites" && profile
        ? profile.favouriteDishIds
            .map((dishId) => repository.getDishById(dishId))
            .filter(Boolean)
            .map((dish) => allVenues.find((v) => v.id === dish!.venueId))
            .filter((v): v is (typeof allVenues)[0] & { matchScore: number } => v !== undefined)
            .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
        : [],
    [allVenues, tab, profile, repository],
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "search", label: "Search", icon: <Search size={14} /> },
    { id: "random", label: "Surprise", icon: <Compass size={14} /> },
    { id: "category", label: "Crave", icon: <Plus size={14} /> },
    { id: "favourites", label: "Faves", icon: <Heart size={14} /> },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close add option sheet"
        accessibilityHint="Dismisses the option picker"
        style={{ flex: 1, backgroundColor: palette.overlay }}
        onPress={onClose}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: radii.xxl,
          borderTopRightRadius: radii.xxl,
          height: "80%",
          ...shadows.floating,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing[5],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 20, fontWeight: "900" }}>Add an Option</AppText>
            {groupDietaryRestrictions.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <ShieldAlert size={12} color={palette.error} />
                <AppText variant="micro" style={{ color: palette.error, fontWeight: "700" }}>
                  GROUP NEEDS: {groupDietaryRestrictions.join(", ").toUpperCase()}
                </AppText>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss add option sheet"
            onPress={onClose}
            hitSlop={12}
            style={{
              backgroundColor: palette.bgSoft,
              width: 32,
              height: 32,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color={palette.text} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[4],
              gap: spacing[2],
            }}
          >
            {tabs.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${t.label} tab`}
                onPress={() => {
                  setTab(t.id);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                  backgroundColor: tab === t.id ? palette.orangeLight : palette.bgSoft,
                  borderWidth: 1,
                  borderColor: tab === t.id ? palette.orange : palette.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View style={{ opacity: tab === t.id ? 1 : 0.6 }}>
                  {t.id === "search" && (
                    <Search size={14} color={tab === t.id ? palette.orange : palette.text} />
                  )}
                  {t.id === "random" && (
                    <Compass size={14} color={tab === t.id ? palette.orange : palette.text} />
                  )}
                  {t.id === "category" && (
                    <Plus size={14} color={tab === t.id ? palette.orange : palette.text} />
                  )}
                  {t.id === "favourites" && (
                    <Heart size={14} color={tab === t.id ? palette.orange : palette.text} />
                  )}
                </View>
                <AppText
                  variant="bodySmall"
                  style={{
                    color: tab === t.id ? palette.orange : palette.text,
                    fontWeight: tab === t.id ? "700" : "500",
                  }}
                >
                  {t.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {tab === "search" && (
            <>
              <View
                style={{
                  paddingHorizontal: spacing[3],
                  paddingBottom: spacing[4],
                }}
              >
                <Input
                  placeholder="Find a specific stall..."
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  leftIcon={<Search size={18} color={palette.textMuted} />}
                />
              </View>
              <FlatList
                data={searchResults}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <VenueRow
                    venue={item}
                    onAdd={() => addVenue(item)}
                    matchScore={item.matchScore}
                  />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  query.trim() ? (
                    <EmptyState
                      title="No stalls found"
                      body={`No stalls found for "${query}".`}
                      icon={<Search size={40} color={palette.textMuted} />}
                    />
                  ) : (
                    <View
                      style={{
                        padding: spacing[8],
                        alignItems: "center",
                        gap: spacing[3],
                      }}
                    >
                      <Search size={40} color={palette.border} />
                      <AppText tone="secondary" style={{ textAlign: "center" }}>
                        Type to search for a stall.
                      </AppText>
                    </View>
                  )
                }
              />
            </>
          )}

          {tab === "random" && (
            <View
              style={{
                padding: spacing[8],
                gap: spacing[6],
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: radii.pill,
                  backgroundColor: palette.bgSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Compass color={palette.orange} size={40} />
              </View>
              <View style={{ gap: spacing[1], alignItems: "center" }}>
                <AppText style={{ fontSize: 20, fontWeight: "800" }}>Surprise Me!</AppText>
                <AppText
                  style={{ textAlign: "center", paddingHorizontal: spacing[3] }}
                  tone="secondary"
                >
                  Can&apos;t decide? Let us pick a random nearby stall for your group.
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick a random stall for me"
                onPress={addRandom}
                style={({ pressed }) => [
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.orange,
                    borderWidth: 2,
                    paddingHorizontal: spacing[8],
                    paddingVertical: spacing[4],
                    borderRadius: radii.pill,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    ...shadows.card,
                  },
                ]}
              >
                <AppText
                  style={{
                    color: palette.orange,
                    fontWeight: "800",
                    fontSize: 18,
                  }}
                >
                  Pick for Me
                </AppText>
              </Pressable>
            </View>
          )}

          {tab === "category" && (
            <>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingBottom: spacing[4],
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: spacing[3],
                    gap: spacing[2],
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      accessibilityRole="button"
                      accessibilityLabel={`${cat} category`}
                      onPress={() => {
                        setSelectedCategory(selectedCategory === cat ? null : cat);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radii.pill,
                        backgroundColor: selectedCategory === cat ? palette.navy : palette.bgSoft,
                        borderWidth: 1,
                        borderColor: selectedCategory === cat ? palette.navy : palette.border,
                      }}
                    >
                      <AppText
                        variant="bodySmall"
                        style={{
                          color: selectedCategory === cat ? palette.textOnDark : palette.text,
                          textTransform: "capitalize",
                          fontWeight: selectedCategory === cat ? "700" : "500",
                        }}
                      >
                        {cat}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <FlatList
                data={categoryResults}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <VenueRow
                    venue={item}
                    onAdd={() => addVenue(item)}
                    matchScore={item.matchScore}
                  />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <EmptyState
                    title="No stalls found"
                    body={
                      selectedCategory
                        ? "No stalls in this category."
                        : "Pick a category above to browse options."
                    }
                    icon={<Plus size={40} color={palette.textMuted} />}
                  />
                }
              />
            </>
          )}

          {tab === "favourites" && (
            <FlatList
              data={favouriteVenues}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <VenueRow venue={item} onAdd={() => addVenue(item)} matchScore={item.matchScore} />
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <EmptyState
                  title="No favourites yet"
                  body="Start liking some dishes to save them for this wheel."
                  icon={<Heart size={40} color={palette.textMuted} />}
                />
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
