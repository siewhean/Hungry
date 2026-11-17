import { Pressable, StyleSheet, View } from "react-native";
import { Trash2 } from "lucide-react-native";

import { AppText, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaborator } from "@/types/domain";

interface CollaboratorRowProps {
  collaborator: PortfolioCollaborator;
  onRemove: () => void;
}

export function CollaboratorRow({ collaborator, onRemove }: CollaboratorRowProps) {
  const { palette } = useHungryTheme();
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.copy}>
          <AppText variant="bodyBold">{collaborator.userId}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {collaborator.role}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove collaborator"
          onPress={onRemove}
          style={styles.iconButton}
        >
          <Trash2 color={palette.errorText} size={18} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
