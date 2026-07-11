import { useMemo } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Star,
  Trash2,
  Users,
} from "lucide-react-native";

import { AppText, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioItem } from "@/types/domain";

interface PortfolioItemRowProps {
  item: PortfolioItem;
  label: string;
  index: number;
  totalCount: number;
  isOwner: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function PortfolioItemRow({
  item,
  label,
  index,
  totalCount,
  isOwner,
  onMoveUp,
  onMoveDown,
  onDelete,
}: PortfolioItemRowProps) {
  const { palette } = useHungryTheme();
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
    <Card>
      <View style={styles.itemHeader}>
        <View style={styles.copy}>
          <AppText variant="bodyBold">{label}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {item.itemType === "dish" ? "Dish" : "Stall"}
          </AppText>
        </View>
        {typeof item.score === "number" ? (
          <View style={styles.scoreWrap}>
            <Star color={palette.amber} fill={palette.amber} size={16} />
            <AppText variant="bodySmallBold">{item.score}/10</AppText>
          </View>
        ) : null}
      </View>
      {item.publicNotes ? (
        <View style={styles.noteRow}>
          <Eye color={palette.textMuted} size={15} />
          <AppText variant="bodySmall" tone="secondary" style={styles.copy}>
            {item.publicNotes}
          </AppText>
        </View>
      ) : null}
      {item.privateNotes && isOwner ? (
        <View style={styles.noteRow}>
          <Users color={palette.textMuted} size={15} />
          <AppText variant="bodySmall" tone="secondary" style={styles.copy}>
            {item.privateNotes}
          </AppText>
        </View>
      ) : null}
      {isOwner ? (
        <View style={styles.actionRow}>
          <View
            {...dragPanResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Drag to reorder portfolio item"
            accessibilityHint="Swipe up or down on this handle to move the item"
            accessibilityActions={[
              { name: "decrement", label: "Move portfolio item up" },
              { name: "increment", label: "Move portfolio item down" },
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move portfolio item up"
            disabled={isFirst}
            onPress={onMoveUp}
            style={[styles.iconButton, { opacity: isFirst ? 0.35 : 1 }]}
          >
            <ChevronUp color={palette.text} size={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move portfolio item down"
            disabled={isLast}
            onPress={onMoveDown}
            style={[styles.iconButton, { opacity: isLast ? 0.35 : 1 }]}
          >
            <ChevronDown color={palette.text} size={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete portfolio item"
            onPress={onDelete}
            style={styles.iconButton}
          >
            <Trash2 color={palette.errorText} size={18} />
          </Pressable>
        </View>
      ) : null}
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
  noteRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  scoreWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
});
