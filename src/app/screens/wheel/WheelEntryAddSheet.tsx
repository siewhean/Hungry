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
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { AppText, Badge, Card, Input } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
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
  const keys = Object.keys(userTaste) as Array<keyof typeof userTaste>;
  keys.forEach(key => {
    const dishVal = (dish.tasteVector as any)[key] || 0;
    const userVal = userTaste[key] || 0;
    score += (dishVal * userVal);
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
  const dishes = mockRepository.listDishesByVenue(venue.id);
  const hero = dishes[0];
  const isHighMatch = matchScore > 120;

  return (
    <Pressable
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
        }
      ]}
    >
      <View style={{ position: "relative" }}>
        {hero?.imageUrl ? (
          <Image
            source={{ uri: hero.imageUrl }}
            style={{ width: 56, height: 56, borderRadius: radii.md, borderWidth: isHighMatch ? 2 : 0, borderColor: palette.orange }}
            contentFit="cover"
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
          <View style={{ position: "absolute", top: -6, left: -6, backgroundColor: palette.orange, borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }}>
            <Sparkles size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText style={{ fontWeight: "700", fontSize: 16 }}>{venue.name}</AppText>
          {isHighMatch && <Badge label="BEST MATCH" tone="orange" />}
        </View>
        <AppText variant="micro" tone="secondary">
          {venue.floor} {venue.unitNumber} • {hero?.tasteTags.slice(0, 2).join(", ")}
        </AppText>
      </View>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.orangeLight, alignItems: "center", justifyContent: "center" }}>
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

  // Group dietary summary
  const groupDietaryRestrictions = useMemo(() => {
    const all = new Set<string>();
    members.forEach(m => m.dietaryPreferences?.forEach(p => all.add(p)));
    return Array.from(all);
  }, [members]);

  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);

  const addedVenueIds = new Set(entries.map((e) => e.venueId));

  function addVenue(venue: VenueSummary) {
    const dishes = mockRepository.listDishesByVenue(venue.id);
    const venueDish = dishes[0];
    
    // Conflict detection
    if (groupDietaryRestrictions.length > 0 && venueDish) {
      const conflicts = groupDietaryRestrictions.filter(pref => 
        !venueDish.dietaryFlags.includes(pref as any)
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
              }
            }
          ]
        );
        return;
      }
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEntry(
      venue.id,
      venue.buildingId,
      venue.name,
      venueDish?.imageUrl ?? ""
    );
    onClose();
  }

  function addRandom() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const all = mockRepository
      .listBuildings()
      .flatMap((b) => mockRepository.listVenuesByBuilding(b.id))
      .filter((v) => !addedVenueIds.has(v.id));
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    addVenue(pick);
  }

  // ── Venue list for search + category ─────────────────────────────────────

  const allVenues = useMemo(() => {
    return mockRepository
      .listBuildings()
      .flatMap((b) =>
        mockRepository.listVenuesByBuilding(b.id).map((v) => ({ 
          ...v, 
          buildingId: b.id,
          matchScore: calculateMatchScore(mockRepository.listDishesByVenue(v.id)[0], profile.tasteVector)
        }))
      )
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [profile.tasteVector]);

  const searchResults = useMemo(() => 
    tab === "search" && query.trim()
      ? allVenues.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
      : [],
    [allVenues, tab, query]
  );

  const categoryResults = useMemo(() => 
    tab === "category" && selectedCategory
      ? allVenues.filter((v) => {
          const dishes = mockRepository.listDishesByVenue(v.id);
          return dishes.some((d) => d.tasteTags.includes(selectedCategory));
        })
      : [],
    [allVenues, tab, selectedCategory]
  );

  const favouriteVenues = useMemo(() => 
    tab === "favourites" && profile
      ? profile.favouriteDishIds
          .map((dishId) => mockRepository.getDishById(dishId))
          .filter(Boolean)
          .map((dish) => allVenues.find((v) => v.id === dish!.venueId))
          .filter((v): v is (typeof allVenues)[0] & { matchScore: number } => v !== undefined)
          .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      : [],
    [allVenues, tab, profile]
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
    >
      <Pressable
        style={{ flex: 1, backgroundColor: palette.overlay }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <ShieldAlert size={12} color={palette.error} />
                <AppText variant="micro" style={{ color: palette.error, fontWeight: "700" }}>
                  GROUP NEEDS: {groupDietaryRestrictions.join(", ").toUpperCase()}
                </AppText>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={{ backgroundColor: palette.bgSoft, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={palette.text} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
              gap: spacing[2],
            }}
          >
            {tabs.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => { setTab(t.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                  borderRadius: 12,
                  backgroundColor: tab === t.id ? palette.orangeLight : palette.bgSoft,
                  borderWidth: 1,
                  borderColor: tab === t.id ? palette.orange : palette.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <View style={{ opacity: tab === t.id ? 1 : 0.6 }}>
                  {t.id === "search" && <Search size={14} color={tab === t.id ? palette.orange : palette.text} />}
                  {t.id === "random" && <Compass size={14} color={tab === t.id ? palette.orange : palette.text} />}
                  {t.id === "category" && <Plus size={14} color={tab === t.id ? palette.orange : palette.text} />}
                  {t.id === "favourites" && <Heart size={14} color={tab === t.id ? palette.orange : palette.text} />}
                </View>
                <AppText
                  variant="bodySmall"
                  style={{ color: tab === t.id ? palette.orange : palette.text, fontWeight: tab === t.id ? "700" : "500" }}
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
              <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
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
                  <VenueRow venue={item} onAdd={() => addVenue(item)} matchScore={item.matchScore} />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  query.trim() ? (
                    <AppText
                      tone="secondary"
                      style={{ textAlign: "center", padding: spacing[8] }}
                    >
                      No stalls found for "{query}"
                    </AppText>
                  ) : (
                    <View style={{ padding: spacing[8], alignItems: "center", gap: spacing[3] }}>
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
            <View style={{ padding: spacing[8], gap: spacing[6], alignItems: "center" }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}>
                <Compass color={palette.orange} size={40} />
              </View>
              <View style={{ gap: 2, alignItems: "center" }}>
                <AppText style={{ fontSize: 20, fontWeight: "800" }}>Surprise Me!</AppText>
                <AppText style={{ textAlign: "center", paddingHorizontal: spacing[4] }} tone="secondary">
                  Can't decide? Let us pick a random nearby stall for your group.
                </AppText>
              </View>
              <Pressable
                onPress={addRandom}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: palette.orange,
                    borderWidth: 2,
                    paddingHorizontal: spacing[8],
                    paddingVertical: spacing[4],
                    borderRadius: radii.pill,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    ...shadows.card
                  }
                ]}
              >
                <AppText style={{ color: palette.orange, fontWeight: "800", fontSize: 18 }}>
                  Pick for Me
                </AppText>
              </Pressable>
            </View>
          )}

          {tab === "category" && (
            <>
              <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: spacing[4] }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: spacing[5],
                    gap: spacing[2],
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setSelectedCategory(selectedCategory === cat ? null : cat);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[2],
                        borderRadius: radii.pill,
                        backgroundColor:
                          selectedCategory === cat ? palette.navy : palette.bgSoft,
                        borderWidth: 1,
                        borderColor:
                          selectedCategory === cat ? palette.navy : palette.border,
                      }}
                    >
                      <AppText
                        variant="bodySmall"
                        style={{
                          color: selectedCategory === cat ? "#FFFFFF" : palette.text,
                          textTransform: "capitalize",
                          fontWeight: selectedCategory === cat ? "700" : "500"
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
                  <VenueRow venue={item} onAdd={() => addVenue(item)} matchScore={item.matchScore} />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <View style={{ padding: spacing[8], alignItems: "center", gap: spacing[3] }}>
                    <Plus size={40} color={palette.border} />
                    <AppText
                      tone="secondary"
                      style={{ textAlign: "center" }}
                    >
                      {selectedCategory
                        ? "No stalls in this category."
                        : "Pick a category above to browse options."}
                    </AppText>
                  </View>
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
                <View style={{ padding: spacing[8], alignItems: "center", gap: spacing[3] }}>
                  <Heart size={40} color={palette.border} />
                  <AppText
                    tone="secondary"
                    style={{ textAlign: "center" }}
                  >
                    No favourites yet. Start liking some dishes!
                  </AppText>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
