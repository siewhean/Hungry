/**
 * WheelEntryAddSheet
 *
 * Bottom-sheet with 4 tabs for adding wheel entries:
 *   1. Search — text search → venue results
 *   2. Random — "Surprise me" picks a stall not already on the wheel: among the closest
 *      ones when location permission is granted, otherwise any stall
 *   3. Browse — browse by SearchCategory chips
 *   4. Favourites — from profile favourite dish IDs
 */

import { useDeferredValue, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View, Alert } from "react-native";
import { X, Search, Compass, Heart, Plus, ShieldAlert, Sparkles } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";

import { AccessibleImage, AppText, Badge, Card, EmptyState, Input } from "@/components/ui";
import { dishMatchesSearchCategory } from "@/lib/services/searchCategoryMatch";
import { pickSurpriseCandidate } from "@/features/wheel/surprisePick";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory, VenueSummary, DishDetail, DietaryFlag } from "@/types/domain";

const CATEGORIES: SearchCategory[] = [
  "local favourites",
  "noodles",
  "rice",
  "desserts",
  "late night",
];

type Tab = "search" | "random" | "category" | "favourites";

/** More slices than this makes labels unreadable on the wheel. */
const MAX_WHEEL_ENTRIES = 12;

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
  hero,
  onAdd,
  matchScore = 0,
}: {
  venue: VenueSummary;
  /** First dish of the venue, looked up once when the venue list is built. */
  hero?: DishDetail;
  onAdd: () => void;
  matchScore?: number;
}) {
  const { palette, spacing, radii } = useHungryTheme();
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
    const all = new Set<DietaryFlag>();
    members.forEach((m) => m.dietaryPreferences?.forEach((p) => all.add(p)));
    return Array.from(all);
  }, [members]);

  const [tab, setTab] = useState<Tab>("search");
  // Distance is used only once location permission is granted; otherwise the pick is uniform.
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const usesLocation = locationPermission === "granted";
  const surpriseOrigin = usesLocation
    ? getEffectiveLocation({ permission: locationPermission, currentLocation, manualCoordinate })
        .coordinate
    : undefined;
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);

  const addedVenueIds = new Set(entries.map((e) => e.venueId));

  const atEntryCap = entries.filter((e) => !e.isEliminated).length >= MAX_WHEEL_ENTRIES;

  function addVenue(venue: VenueSummary) {
    if (atEntryCap) {
      Alert.alert("The wheel is full", `Remove an option first (up to ${MAX_WHEEL_ENTRIES}).`);
      return;
    }
    const dishes = repository.listDishesByVenue(venue.id);
    const venueDish = dishes[0];

    // Conflict detection: a need is a conflict only if no dish at the stall meets it.
    if (groupDietaryRestrictions.length > 0 && dishes.length > 0) {
      const conflicts = groupDietaryRestrictions.filter(
        (pref) => !dishes.some((dish) => dish.dietaryFlags.includes(pref)),
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
                addEntry(venue.id, venue.buildingId, venue.name, venueDish?.imageUrl ?? "");
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
    const candidates = repository.listBuildings().flatMap((b) =>
      repository
        .listVenuesByBuilding(b.id)
        .filter((v) => !addedVenueIds.has(v.id))
        .map((venue) => ({ item: venue, coordinate: b.coordinate })),
    );
    if (candidates.length === 0) {
      Alert.alert("Nothing left to add", "Every stall is already on the wheel.");
      return;
    }
    const pick = pickSurpriseCandidate(candidates, surpriseOrigin);
    if (pick) addVenue(pick);
  }

  // ── Venue list for search + category ─────────────────────────────────────

  // Built once while the sheet is open: each venue's dishes are looked up a single time
  // (repositories index dishes by venue) and reused by search, browse and the rows.
  const allVenues = useMemo(() => {
    if (!visible) return [];
    return repository
      .listBuildings()
      .flatMap((b) =>
        repository.listVenuesByBuilding(b.id).map((v) => {
          const dishes = repository.listDishesByVenue(v.id);
          return {
            ...v,
            buildingId: b.id,
            dishes,
            hero: dishes[0] as DishDetail | undefined,
            matchScore: calculateMatchScore(dishes[0], profile.tasteVector),
          };
        }),
      )
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [profile.tasteVector, repository, visible]);

  // Typing stays responsive: filtering runs on the deferred query.
  const deferredQuery = useDeferredValue(query);
  const searchResults = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return tab === "search" && normalizedQuery
      ? allVenues.filter((v) => v.name.toLowerCase().includes(normalizedQuery))
      : [];
  }, [allVenues, tab, deferredQuery]);

  const categoryResults = useMemo(
    () =>
      tab === "category" && selectedCategory
        ? allVenues.filter((v) =>
            v.dishes.some((dish) => dishMatchesSearchCategory(dish, selectedCategory)),
          )
        : [],
    [allVenues, tab, selectedCategory],
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
    { id: "category", label: "Browse", icon: <Plus size={14} /> },
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
                    hero={item.hero}
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
                  {usesLocation
                    ? "Can't decide? We'll add a random stall close to you."
                    : "Can't decide? Let us add a random stall to the wheel."}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  usesLocation ? "Pick a random stall close to me" : "Pick a random stall for me"
                }
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
                    hero={item.hero}
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
                <VenueRow
                  venue={item}
                  hero={item.hero}
                  onAdd={() => addVenue(item)}
                  matchScore={item.matchScore}
                />
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
