import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { AppText, Button, Card, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { runListMutation } from "@/features/checklistPortfolio/runListMutation";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "ChecklistItemPicker">;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const REMINDER_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseDateOnly(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error("Use YYYY-MM-DD.");
  }
  const [, year, month, day] = match.map(Number);
  if (!isValidDateParts(year, month, day)) {
    throw new Error("Use a real calendar date.");
  }
  return trimmed;
}

function parseReminderDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = REMINDER_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error("Use YYYY-MM-DD HH:mm.");
  }
  const [, yearValue, monthValue, dayValue, hourValue = "09", minuteValue = "00"] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!isValidDateParts(year, month, day) || hour > 23 || minute > 59) {
    throw new Error("Use a real date and time.");
  }
  return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}:00+08:00`;
}

function getFieldError(parser: (value: string) => string | undefined, value: string) {
  try {
    parser(value);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Use the required format.";
  }
}

export function ChecklistItemPickerScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { checklistId, mode } = route.params;
  const insets = useSafeAreaInsets();
  const topSpacing = Math.max(insets.top, spacing[4]);
  const addItem = useChecklistStore((state) => state.addItem);
  const [query, setQuery] = useState("");
  const [customText, setCustomText] = useState("");
  const [plannedVisitDate, setPlannedVisitDate] = useState("");
  const [reminderDateTime, setReminderDateTime] = useState("");
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const service = getHungryService();

    async function loadChoices() {
      if (mode === "custom") return;
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
      const nextVenues = venueLists
        .flat()
        .filter((venue) => venue.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 16);
      if (mounted) setVenues(nextVenues);
    }

    void loadChoices();
    return () => {
      mounted = false;
    };
  }, [mode, query]);

  const title = mode === "dish" ? "Add dish" : mode === "stall" ? "Add stall" : "Add custom item";
  const canSaveCustom = customText.trim().length > 0;
  const visibleDishes = useMemo(() => dishes, [dishes]);
  const visibleVenues = useMemo(() => venues, [venues]);
  const plannedVisitDateError = getFieldError(parseDateOnly, plannedVisitDate);
  const reminderDateTimeError = getFieldError(parseReminderDateTime, reminderDateTime);
  const hasScheduleError = Boolean(plannedVisitDateError || reminderDateTimeError);

  function getSchedulePayload() {
    return {
      plannedVisitDate: parseDateOnly(plannedVisitDate),
      reminderAt: parseReminderDateTime(reminderDateTime),
    };
  }

  async function addDish(dish: DishDetail) {
    if (hasScheduleError) return;
    setIsSaving(true);
    try {
      const added = await runListMutation(
        () => addItem({ checklistId, itemType: "dish", dishId: dish.id, ...getSchedulePayload() }),
        {
          success: "Added to checklist",
          failure: "Couldn't add to checklist.",
        },
      );
      if (added) navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  }

  async function addVenue(venue: VenueSummary) {
    if (hasScheduleError) return;
    setIsSaving(true);
    try {
      const added = await runListMutation(
        () =>
          addItem({
            checklistId,
            itemType: "stall",
            stallId: venue.id,
            ...getSchedulePayload(),
          }),
        {
          success: "Added to checklist",
          failure: "Couldn't add to checklist.",
        },
      );
      if (added) navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  }

  async function addCustom() {
    if (!canSaveCustom || hasScheduleError) return;
    setIsSaving(true);
    try {
      const added = await runListMutation(
        () => addItem({ checklistId, itemType: "custom", customText, ...getSchedulePayload() }),
        {
          success: "Added to checklist",
          failure: "Couldn't add to checklist.",
        },
      );
      if (added) navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: topSpacing }}
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
          <AppText variant="h1">{title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {mode === "custom"
              ? "Save something Hungry does not know yet."
              : "Pick from Hungry results."}
          </AppText>
        </View>
      </View>

      {mode === "custom" ? (
        <Card>
          <Input
            label="Item name"
            placeholder="e.g. Grandma's mee siam"
            value={customText}
            onChangeText={setCustomText}
          />
          <ScheduleFields
            plannedVisitDate={plannedVisitDate}
            plannedVisitDateError={plannedVisitDateError}
            reminderDateTime={reminderDateTime}
            reminderDateTimeError={reminderDateTimeError}
            onPlannedVisitDateChange={setPlannedVisitDate}
            onReminderDateTimeChange={setReminderDateTime}
          />
          <Button
            label="Add custom item"
            loading={isSaving}
            disabled={!canSaveCustom || hasScheduleError}
            onPress={addCustom}
          />
        </Card>
      ) : (
        <>
          <Input
            label="Search"
            placeholder={mode === "dish" ? "Find dishes..." : "Find stalls..."}
            value={query}
            onChangeText={setQuery}
            leftIcon={<Search color={palette.textMuted} size={18} />}
          />
          <Card>
            <ScheduleFields
              plannedVisitDate={plannedVisitDate}
              plannedVisitDateError={plannedVisitDateError}
              reminderDateTime={reminderDateTime}
              reminderDateTimeError={reminderDateTimeError}
              onPlannedVisitDateChange={setPlannedVisitDate}
              onReminderDateTimeChange={setReminderDateTime}
            />
          </Card>
          {(mode === "dish" ? visibleDishes : visibleVenues).length === 0 ? (
            <Card>
              <AppText variant="h3">No results yet</AppText>
              <AppText variant="body" tone="secondary">
                Try another search or add a custom item instead.
              </AppText>
              <Button
                label="Add custom"
                variant="secondary"
                onPress={() => navigation.setParams({ mode: "custom" })}
              />
            </Card>
          ) : null}
          {mode === "dish"
            ? visibleDishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${dish.name} to checklist`}
                  disabled={isSaving || hasScheduleError}
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
            : visibleVenues.map((venue) => (
                <Pressable
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${venue.name} to checklist`}
                  disabled={isSaving || hasScheduleError}
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
        </>
      )}
    </ScrollView>
  );
}

function ScheduleFields({
  plannedVisitDate,
  plannedVisitDateError,
  reminderDateTime,
  reminderDateTimeError,
  onPlannedVisitDateChange,
  onReminderDateTimeChange,
}: {
  plannedVisitDate: string;
  plannedVisitDateError?: string;
  reminderDateTime: string;
  reminderDateTimeError?: string;
  onPlannedVisitDateChange: (value: string) => void;
  onReminderDateTimeChange: (value: string) => void;
}) {
  const { spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="bodyBold">Plan it</AppText>
        <AppText variant="bodySmall" tone="secondary">
          Optional dates help this checklist turn into a real food plan.
        </AppText>
      </View>
      <Input
        label="Planned visit date"
        placeholder="YYYY-MM-DD"
        value={plannedVisitDate}
        onChangeText={onPlannedVisitDateChange}
        autoCapitalize="none"
        autoCorrect={false}
        error={Boolean(plannedVisitDateError)}
        errorText={plannedVisitDateError}
        helperText="Leave blank if you only want to save it for later."
      />
      <Input
        label="Reminder"
        placeholder="YYYY-MM-DD HH:mm"
        value={reminderDateTime}
        onChangeText={onReminderDateTimeChange}
        autoCapitalize="none"
        autoCorrect={false}
        error={Boolean(reminderDateTimeError)}
        errorText={reminderDateTimeError}
        helperText="Singapore time. A date without time defaults to 09:00."
      />
    </View>
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
