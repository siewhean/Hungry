import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { AppText, Button, Card, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioItemPicker">;

function parsePortfolioScore(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Whole numbers only: the stored score is an integer, so 8.5 would be silently rounded.
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number.parseInt(trimmed, 10);
}

export function PortfolioItemPickerScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { portfolioId, mode } = route.params;
  const addItem = usePortfolioStore((state) => state.addItem);
  const conflict = usePortfolioStore((state) => state.conflicts[portfolioId]);
  const clearConflict = usePortfolioStore((state) => state.clearConflict);
  const [query, setQuery] = useState("");
  const [score, setScore] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const parsedScore = parsePortfolioScore(score);
  const scoreError =
    parsedScore !== undefined && (Number.isNaN(parsedScore) || parsedScore < 1 || parsedScore > 10)
      ? "Use a whole number from 1 to 10."
      : undefined;
  const canAddItem = !scoreError && !isSaving;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // `mounted` drops results from a superseded search; the timer debounces typing.
    let mounted = true;
    const service = getHungryService();

    async function loadChoices() {
      if (mode === "dish") {
        const results = await service.discovery.searchDishes(
          {
            query,
            categories: [],
            dietaryFlags: [],
            tasteValues: NEUTRAL_TASTE_VECTOR,
            radius: 5000,
          },
          NEUTRAL_TASTE_VECTOR,
        );
        if (mounted) setDishes(results.slice(0, 12).map((result) => result.dish));
        return;
      }

      const buildings = await service.discovery.listBuildings();
      const venueLists = await Promise.all(
        buildings
          .slice(0, 6)
          .map((building) => service.discovery.listVenuesByBuilding(building.id)),
      );
      const normalizedQuery = query.trim().toLowerCase();
      const nextVenues = venueLists
        .flat()
        .filter((venue) => venue.name.toLowerCase().includes(normalizedQuery))
        .slice(0, 16);
      if (mounted) setVenues(nextVenues);
    }

    const timer = setTimeout(() => {
      void loadChoices().catch((error) => console.error("Failed to search:", error));
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [mode, query]);

  async function addDish(dish: DishDetail) {
    setIsSaving(true);
    try {
      await addItem({
        portfolioId,
        itemType: "dish",
        dishId: dish.id,
        score: parsedScore,
        publicNotes,
        privateNotes,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Portfolio update failed",
        error instanceof Error ? error.message : "Please refresh and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function addVenue(venue: VenueSummary) {
    setIsSaving(true);
    try {
      await addItem({
        portfolioId,
        itemType: "stall",
        stallId: venue.id,
        score: parsedScore,
        publicNotes,
        privateNotes,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Portfolio update failed",
        error instanceof Error ? error.message : "Please refresh and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: Math.max(insets.top, spacing[4]) }}
      contentContainerStyle={[styles.content, { gap: spacing[4], padding: spacing[4] }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">{mode === "dish" ? "Add dish" : "Add stall"}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Add a score and notes, then pick an item.
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="Score"
          value={score}
          onChangeText={setScore}
          keyboardType="number-pad"
          placeholder="Optional"
          helperText={scoreError ?? "Optional. A whole number from 1 to 10 for rankings."}
        />
        <Input
          label="Public note"
          value={publicNotes}
          onChangeText={setPublicNotes}
          placeholder="Visible when this portfolio is shared"
          multiline
        />
        <Input
          label="Private note"
          value={privateNotes}
          onChangeText={setPrivateNotes}
          placeholder="Only for you and collaborators"
          multiline
        />
      </Card>

      {conflict ? (
        <Card>
          <AppText variant="bodyBold">Latest version loaded</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {conflict.message}
          </AppText>
          <Button
            label="Review latest"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onPress={() => clearConflict(portfolioId)}
          />
        </Card>
      ) : null}

      <Input
        label="Search"
        placeholder={mode === "dish" ? "Find dishes..." : "Find stalls..."}
        value={query}
        onChangeText={setQuery}
        leftIcon={<Search color={palette.textMuted} size={18} />}
      />

      {(mode === "dish" ? dishes : venues).length === 0 ? (
        <Card>
          <AppText variant="h3">No results yet</AppText>
          <AppText variant="body" tone="secondary">
            Try another search term.
          </AppText>
        </Card>
      ) : null}

      {mode === "dish"
        ? dishes.map((dish) => (
            <Pressable
              key={dish.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${dish.name} to portfolio`}
              disabled={!canAddItem}
              onPress={() => addDish(dish)}
            >
              <Card>
                <AppText variant="bodyBold">{dish.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {dish.venueName} · {dish.priceRange}
                </AppText>
              </Card>
            </Pressable>
          ))
        : venues.map((venue) => (
            <Pressable
              key={venue.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${venue.name} to portfolio`}
              disabled={!canAddItem}
              onPress={() => addVenue(venue)}
            >
              <Card>
                <AppText variant="bodyBold">{venue.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue.floor} · {venue.unitNumber}
                </AppText>
              </Card>
            </Pressable>
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
});
