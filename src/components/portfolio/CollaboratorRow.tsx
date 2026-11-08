import { Pressable, StyleSheet, View } from "react-native";
import { Trash2 } from "lucide-react-native";

import { AppText, Avatar, Button, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaborator } from "@/types/domain";
import { AppSymbol } from "@/components/ui/AppSymbol";

interface CollaboratorRowProps {
  collaborator: PortfolioCollaborator;
  onRemove?: () => void;
  /** Switches between viewer and editor without removing the person. */
  onChangeRole?: (role: PortfolioCollaborator["role"]) => void;
}

export function collaboratorName(collaborator: Pick<PortfolioCollaborator, "displayName">) {
  return collaborator.displayName?.trim() || "Hungry member";
}

export function CollaboratorRow({ collaborator, onRemove, onChangeRole }: CollaboratorRowProps) {
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
        {onChangeRole ? (
          <Button
            label={collaborator.role === "editor" ? "Make viewer" : "Make editor"}
            accessibilityLabel={`${
              collaborator.role === "editor" ? "Make viewer" : "Make editor"
            }: ${name}`}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => onChangeRole(collaborator.role === "editor" ? "viewer" : "editor")}
          />
        ) : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
            onPress={onRemove}
            style={styles.iconButton}
          >
            <AppSymbol name="trash" fallback={Trash2} size={18} color={palette.errorText} />
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
