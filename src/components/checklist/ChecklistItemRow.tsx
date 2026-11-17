import { useMemo } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from "lucide-react-native";

import { AppText, Button, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { ChecklistItem } from "@/types/domain";

interface ChecklistItemRowProps {
  item: ChecklistItem;
  label: string;
  index: number;
  totalCount: number;
  onEdit?: () => void;
  onMarkTried: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function getChecklistItemKind(item: ChecklistItem): string {
  if (item.itemType === "custom") return "Custom item";
  if (item.itemType === "dish") return "Dish";
  return "Stall";
}

function formatDateOnly(value: string): string {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });
}

function formatReminder(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-SG", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Singapore",
  });
}

function getScheduleLabel(item: ChecklistItem): string {
  const parts = [];
  if (item.plannedVisitDate) {
    parts.push(`Planned ${formatDateOnly(item.plannedVisitDate)}`);
  }
  if (item.reminderAt) {
    parts.push(`Planned time ${formatReminder(item.reminderAt)}`);
  }
  return parts.join(" · ");
}

export function ChecklistItemRow({
  item,
  label,
  index,
  totalCount,
  onMarkTried,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ChecklistItemRowProps) {
  const { palette, spacing } = useHungryTheme();
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;
  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 12 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dy < -36 && !isFirst) {
            onMoveUp();
          }
          if (gestureState.dy > 36 && !isLast) {
            onMoveDown();
          }
        },
      }),
    [isFirst, isLast, onMoveDown, onMoveUp],
  );

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={styles.itemHeader}>
        <View style={styles.copy}>
          <AppText variant="bodyBold">{label}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {getChecklistItemKind(item)}
          </AppText>
        </View>
        {item.triedAt ? <CheckCircle2 color={palette.successText} size={22} /> : null}
      </View>
      {item.plannedVisitDate || item.reminderAt ? (
        <View style={styles.metaRow}>
          <CalendarDays color={palette.textMuted} size={15} />
          <AppText variant="bodySmall" tone="secondary">
            {getScheduleLabel(item)}
          </AppText>
        </View>
      ) : null}
      {onEdit ? <Button label="Edit planned time" variant="secondary" onPress={onEdit} /> : null}
      <View style={styles.actionRow}>
        <View
          {...dragPanResponder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Drag to reorder checklist item"
          accessibilityHint="Swipe up or down on this handle to move the item"
          accessibilityActions={[
            { name: "decrement", label: "Move item up" },
            { name: "increment", label: "Move item down" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "decrement" && !isFirst) {
              onMoveUp();
            }
            if (event.nativeEvent.actionName === "increment" && !isLast) {
              onMoveDown();
            }
          }}
          style={[styles.iconButton, styles.dragHandle]}
        >
          <GripVertical color={palette.textMuted} size={18} />
        </View>
        <Button
          label={item.triedAt ? "Undo tried" : "Mark tried"}
          size="sm"
          fullWidth={false}
          variant={item.triedAt ? "secondary" : "primary"}
          onPress={onMarkTried}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move item up"
          disabled={isFirst}
          onPress={onMoveUp}
          style={[styles.iconButton, { opacity: isFirst ? 0.35 : 1 }]}
        >
          <ChevronUp color={palette.text} size={18} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move item down"
          disabled={isLast}
          onPress={onMoveDown}
          style={[styles.iconButton, { opacity: isLast ? 0.35 : 1 }]}
        >
          <ChevronDown color={palette.text} size={18} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete checklist item"
          onPress={onDelete}
          style={styles.iconButton}
        >
          <Trash2 color={palette.errorText} size={18} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  copy: {
    flex: 1,
  },
  dragHandle: {
    borderRadius: 22,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  itemHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
});
