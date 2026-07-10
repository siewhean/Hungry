import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { ChecklistItemRow } from "@/components/checklist";
import { AppText, Button, Card, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useHungryTheme } from "@/theme";
import type { ChecklistItem } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "ChecklistDetail">;

function formatChecklistItemLabel(item: ChecklistItem, labels: Record<string, string>) {
  if (item.customText) return item.customText;
  if (item.dishId) return labels[item.dishId] ?? "Deleted dish";
  if (item.stallId) return labels[item.stallId] ?? "Deleted stall";
  return "Checklist item";
}

export function ChecklistDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const checklistId = route.params.checklistId;
  const {
    checklists,
    items,
    loadChecklists,
    loadChecklistItems,
    updateChecklist,
    markItemTried,
    deleteItem,
    reorderItems,
  } = useChecklistStore();
  const checklist = checklists.find((entry) => entry.id === checklistId);
  const checklistItems = items[checklistId] ?? [];
  const [draftName, setDraftName] = useState(checklist?.name ?? "");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const insets = useSafeAreaInsets();
  const topSpacing = Math.max(insets.top, spacing[4]);

  useEffect(() => {
    void loadChecklists();
    void loadChecklistItems(checklistId);
  }, [checklistId, loadChecklistItems, loadChecklists]);

  useEffect(() => {
    setDraftName(checklist?.name ?? "");
  }, [checklist?.name]);

  useEffect(() => {
    let mounted = true;
    const service = getHungryService();

    async function hydrateLabels() {
      const nextLabels: Record<string, string> = {};
      await Promise.all(
        checklistItems.map(async (item) => {
          if (item.dishId) {
            const dish = await service.discovery.getDish(item.dishId);
            if (dish) nextLabels[item.dishId] = dish.name;
          }
          if (item.stallId) {
            const venue = await service.discovery.getVenue(item.stallId);
            if (venue) nextLabels[item.stallId] = venue.name;
          }
        }),
      );
      if (mounted) setLabels(nextLabels);
    }

    void hydrateLabels();
    return () => {
      mounted = false;
    };
  }, [checklistItems]);

  const triedCount = useMemo(
    () => checklistItems.filter((item) => Boolean(item.triedAt)).length,
    [checklistItems],
  );

  const saveName = useCallback(async () => {
    if (!checklist) return;
    const nextName = draftName.trim();
    if (!nextName || nextName === checklist.name) return;
    await updateChecklist(checklist.id, nextName);
  }, [checklist, draftName, updateChecklist]);

  const moveItem = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      const currentIndex = checklistItems.findIndex((item) => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= checklistItems.length) return;
      const nextIds = checklistItems.map((item) => item.id);
      const [movedItem] = nextIds.splice(currentIndex, 1);
      nextIds.splice(nextIndex, 0, movedItem);
      await reorderItems(checklistId, nextIds);
    },
    [checklistId, checklistItems, reorderItems],
  );

  if (!checklist) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: palette.bg,
            padding: spacing[5],
            paddingTop: Math.max(topSpacing, spacing[5]),
          },
        ]}
      >
        <AppText variant="h2">Checklist not found</AppText>
        <Button
          label="Go back"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    );
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
          <AppText variant="h1">Checklist</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {checklistItems.length} item{checklistItems.length === 1 ? "" : "s"} · {triedCount}{" "}
            tried
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="Checklist name"
          value={draftName}
          onChangeText={setDraftName}
          onBlur={saveName}
        />
        <View style={styles.actionRow}>
          <Button
            label="Dish"
            size="sm"
            fullWidth={false}
            leftIcon={<Plus color={palette.textOnOrange} size={16} />}
            onPress={() =>
              navigation.navigate("ChecklistItemPicker", { checklistId, mode: "dish" })
            }
          />
          <Button
            label="Stall"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onPress={() =>
              navigation.navigate("ChecklistItemPicker", { checklistId, mode: "stall" })
            }
          />
          <Button
            label="Custom"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onPress={() =>
              navigation.navigate("ChecklistItemPicker", { checklistId, mode: "custom" })
            }
          />
        </View>
      </Card>

      {checklistItems.length === 0 ? (
        <Card>
          <AppText variant="h3">Nothing here yet</AppText>
          <AppText variant="body" tone="secondary">
            Add dishes, stalls, or a custom note to plan what you want to try next.
          </AppText>
        </Card>
      ) : (
        checklistItems.map((item, index) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            label={formatChecklistItemLabel(item, labels)}
            index={index}
            totalCount={checklistItems.length}
            onMarkTried={() => markItemTried(item.id)}
            onMoveUp={() => moveItem(item.id, -1)}
            onMoveDown={() => moveItem(item.id, 1)}
            onDelete={() => {
              Alert.alert("Remove item?", "This removes it from this checklist.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => void deleteItem(item.id, checklistId),
                },
              ]);
            }}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
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
