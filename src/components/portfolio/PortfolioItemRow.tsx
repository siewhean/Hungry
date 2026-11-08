import { useMemo } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Pencil,
  Star,
  Trash2,
  Users,
} from "lucide-react-native";

import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Card } from "@/components/ui";
import type { ItemDetail } from "@/features/checklistPortfolio/useItemLabels";
import { useHungryTheme } from "@/theme";
import type { PortfolioItem } from "@/types/domain";
import { AppSymbol } from "@/components/ui/AppSymbol";

interface PortfolioItemRowProps {
  item: PortfolioItem;
  label: string;
  /** Photo, stall and price once loaded. */
  detail?: ItemDetail;
  index: number;
  totalCount: number;
  /** Ranking lists show "#1", "#2"... before the name. */
  showRank?: boolean;
  /** Owner or editor collaborator: shows reorder and remove. */
  canEdit: boolean;
  /** Opens the dish or stall page. */
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Opens the score and notes editor. */
  onEdit?: () => void;
  onDelete: () => void;
}

export function PortfolioItemRow({
  item,
  label,
  detail,
  index,
  totalCount,
  showRank = false,
  canEdit,
  onOpen,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: PortfolioItemRowProps) {
  const { palette, radii } = useHungryTheme();
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

  const title = showRank ? `#${index + 1} ${label}` : label;
  const subtitle =
    item.itemType === "dish"
      ? [
          "Dish",
          detail?.stallName,
          detail?.price !== undefined ? `S$${detail.price.toFixed(2)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Stall";
  const thumbStyle = { borderRadius: radii.sm, height: 56, width: 56 };

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${label}`}
        accessibilityHint={
          item.itemType === "dish" ? "Opens the dish page" : "Opens the stall page"
        }
        onPress={onOpen}
        style={styles.itemHeader}
      >
        {detail?.imageUrl ? (
          <AccessibleImage
            source={{ uri: detail.imageUrl }}
            style={thumbStyle}
            contentFit="cover"
            decorative
          />
        ) : (
          <NoDishPhoto dishName={label} style={thumbStyle} iconSize={20} />
        )}
        <View style={styles.copy}>
          <AppText variant="bodyBold" numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        {typeof item.score === "number" ? (
          <View style={styles.scoreWrap}>
            <AppSymbol
              name="star.fill"
              fallback={Star}
              filled
              size={16}
              color={palette.starStroke}
            />
            <AppText variant="bodySmallBold">{item.score}/10</AppText>
          </View>
        ) : null}
      </Pressable>
      {item.publicNotes ? (
        <View style={styles.noteRow}>
          <AppSymbol name="eye" fallback={Eye} size={15} color={palette.textMuted} />
          <AppText variant="bodySmall" tone="secondary" style={styles.copy}>
            {item.publicNotes}
          </AppText>
        </View>
      ) : null}
      {/* The server returns private notes only to the owner and collaborators. */}
      {item.privateNotes ? (
        <View style={styles.noteRow}>
          <AppSymbol name="person.2" fallback={Users} size={15} color={palette.textMuted} />
          <AppText variant="bodySmall" tone="secondary" style={styles.copy}>
            {item.privateNotes}
          </AppText>
        </View>
      ) : null}
      {canEdit ? (
        <View style={styles.actionRow}>
          <View
            {...dragPanResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Drag to reorder list item"
            accessibilityHint="Swipe up or down on this handle to move the item"
            accessibilityActions={[
              { name: "decrement", label: "Move list item up" },
              { name: "increment", label: "Move list item down" },
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
            <AppSymbol
              name="line.3.horizontal"
              fallback={GripVertical}
              size={18}
              color={palette.textMuted}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${label} up`}
            disabled={isFirst}
            onPress={onMoveUp}
            style={[styles.iconButton, { opacity: isFirst ? 0.35 : 1 }]}
          >
            <AppSymbol name="chevron.up" fallback={ChevronUp} size={18} color={palette.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${label} down`}
            disabled={isLast}
            onPress={onMoveDown}
            style={[styles.iconButton, { opacity: isLast ? 0.35 : 1 }]}
          >
            <AppSymbol name="chevron.down" fallback={ChevronDown} size={18} color={palette.text} />
          </Pressable>
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit score and notes for ${label}`}
              onPress={onEdit}
              style={styles.iconButton}
            >
              <AppSymbol name="pencil" fallback={Pencil} size={18} color={palette.text} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label} from this list`}
            onPress={onDelete}
            style={styles.iconButton}
          >
            <AppSymbol name="trash" fallback={Trash2} size={18} color={palette.errorText} />
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
