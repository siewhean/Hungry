import { Pressable, StyleSheet, View } from "react-native";

import { AppText, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { Checklist } from "@/types/domain";

interface ChecklistCardProps {
  checklist: Checklist;
  itemCount?: number;
  triedCount?: number;
  onPress: () => void;
}

export function ChecklistCard({
  checklist,
  itemCount = 0,
  triedCount = 0,
  onPress,
}: ChecklistCardProps) {
  const { spacing } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${checklist.name}`}
      onPress={onPress}
    >
      <Card style={{ gap: spacing[2] }}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <AppText variant="bodyBold">{checklist.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {itemCount} item{itemCount === 1 ? "" : "s"} · {triedCount} tried
            </AppText>
          </View>
          <AppText variant="micro" tone="muted">
            {new Date(checklist.updatedAt).toLocaleDateString()}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
