import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioItemEditSheet, type PortfolioItemDetailsInput } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { listErrorMessage } from "@/features/checklistPortfolio/listLoadState";
import {
  canShowMorePickerResults,
  nextPickerLimit,
  PICKER_PAGE_SIZE,
  searchPickerDishes,
  searchPickerVenues,
} from "@/features/checklistPortfolio/pickerSearch";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioItemPicker">;

/** The dish or stall just tapped, waiting for its score and notes. */
type PendingItem =
  | { kind: "dish"; id: string; label: string }
  | { kind: "stall"; id: string; label: string };

export function PortfolioItemPickerScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { portfolioId, mode } = route.params;
  const addItem = usePortfolioStore((state) => state.addItem);
  const conflict = usePortfolioStore((state) => state.conflicts[portfolioId]);
  const clearConflict = usePortfolioStore((state) => state.clearConflict);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingItem | null>(null);
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [resultLimit, setResultLimit] = useState(PICKER_PAGE_SIZE);
  const [isSaving, setIsSaving] = useState(false);
  const canAddItem = !isSaving;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // `mounted` drops results from a superseded search; the timer debounces typing.
    let mounted = true;

    async function loadChoices() {
      if (mode === "dish") {
        const nextDishes = await searchPickerDishes(query, resultLimit);
        if (mounted) setDishes(nextDishes);
        return;
      }
      // Whole catalog via the venue search RPC, not the first few buildings.
      const nextVenues = await searchPickerVenues(query, resultLimit);
      if (mounted) setVenues(nextVenues);
    }

    const timer = setTimeout(() => {
      void loadChoices().catch((error) => console.error("Failed to search:", error));
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [mode, query, resultLimit]);

  async function addPending(details: PortfolioItemDetailsInput) {
    if (!pending) return;
    setIsSaving(true);
    try {
      await addItem({
        portfolioId,
        itemType: pending.kind,
        ...(pending.kind === "dish" ? { dishId: pending.id } : { stallId: pending.id }),
        score: details.score,
        publicNotes: details.publicNotes.trim(),
        privateNotes: details.privateNotes.trim(),
      });
      setPending(null);
      navigation.goBack();
    } catch (error) {
      Alert.alert("List update failed", listErrorMessage(error, "Please refresh and try again."));
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
            Pick an item, then add a score and notes if you like.
          </AppText>
        </View>
      </View>

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
        onChangeText={(text) => {
          setQuery(text);
          setResultLimit(PICKER_PAGE_SIZE);
        }}
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
              accessibilityLabel={`Add ${dish.name} to list`}
              disabled={!canAddItem}
              onPress={() => setPending({ kind: "dish", id: dish.id, label: dish.name })}
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
              accessibilityLabel={`Add ${venue.name} to list`}
              disabled={!canAddItem}
              onPress={() => setPending({ kind: "stall", id: venue.id, label: venue.name })}
            >
              <Card>
                <AppText variant="bodyBold">{venue.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {venue.floor} · {venue.unitNumber}
                </AppText>
              </Card>
            </Pressable>
          ))}

      {canShowMorePickerResults((mode === "dish" ? dishes : venues).length, resultLimit) ? (
        <Button
          label="Show more"
          variant="secondary"
          onPress={() => setResultLimit((limit) => nextPickerLimit(limit))}
        />
      ) : null}

      <PortfolioItemEditSheet
        visible={pending !== null}
        title={pending?.label ?? ""}
        confirmLabel="Add to list"
        isSaving={isSaving}
        onClose={() => setPending(null)}
        onSubmit={(details) => void addPending(details)}
      />
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
