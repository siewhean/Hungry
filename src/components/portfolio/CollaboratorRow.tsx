import { Pressable, StyleSheet, View } from "react-native";
import { Trash2 } from "lucide-react-native";

import { AppText, Avatar, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaborator } from "@/types/domain";

interface CollaboratorRowProps {
  collaborator: PortfolioCollaborator;
  onRemove?: () => void;
}

export function collaboratorName(collaborator: Pick<PortfolioCollaborator, "displayName">) {
  return collaborator.displayName?.trim() || "Hungry member";
}

export function CollaboratorRow({ collaborator, onRemove }: CollaboratorRowProps) {
  const { palette } = useHungryTheme();
  const name = collaboratorName(collaborator);
  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={name} uri={collaborator.avatarUrl} size={40} />
        <View style={styles.copy}>
          <AppText variant="bodyBold">{name}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {collaborator.role === "editor" ? "Can edit" : "Can view"}
          </AppText>
        </View>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
            onPress={onRemove}
            style={styles.iconButton}
          >
            <Trash2 color={palette.errorText} size={18} />
          </Pressable>
        ) : null}
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
