import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, UserPlus } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { CollaboratorRow } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaboratorRole } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCollaborators">;

export function PortfolioCollaboratorsScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const { collaborators, loadPortfolioCollaborators, addCollaborator, removeCollaborator } =
    usePortfolioStore();
  const portfolioCollaborators = collaborators[portfolioId] ?? [];
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PortfolioCollaboratorRole>("viewer");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadPortfolioCollaborators(portfolioId);
  }, [loadPortfolioCollaborators, portfolioId]);

  async function add() {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return;
    setIsSaving(true);
    try {
      await addCollaborator(portfolioId, normalizedUserId, role);
      setUserId("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
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
          <AppText variant="h1">Collaborators</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Add trusted people to view or edit this portfolio.
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="User id"
          value={userId}
          onChangeText={setUserId}
          placeholder="Paste a Hungry user id"
        />
        <View style={styles.actionRow}>
          {(["viewer", "editor"] as PortfolioCollaboratorRole[]).map((nextRole) => (
            <Pressable
              key={nextRole}
              accessibilityRole="radio"
              accessibilityState={{ checked: role === nextRole }}
              onPress={() => setRole(nextRole)}
              style={[
                styles.roleChip,
                {
                  backgroundColor: role === nextRole ? palette.orangeLight : palette.surfaceRaised,
                  borderColor: role === nextRole ? palette.orange : palette.border,
                },
              ]}
            >
              <AppText variant="bodySmallBold" tone={role === nextRole ? "accent" : "secondary"}>
                {nextRole}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Button
          label="Add collaborator"
          loading={isSaving}
          disabled={!userId.trim()}
          leftIcon={<UserPlus color={palette.textOnOrange} size={18} />}
          onPress={add}
        />
      </Card>

      {portfolioCollaborators.length === 0 ? (
        <Card>
          <AppText variant="h3">No collaborators yet</AppText>
          <AppText variant="body" tone="secondary">
            Collaborators appear here after you add them.
          </AppText>
        </Card>
      ) : (
        portfolioCollaborators.map((collaborator) => (
          <CollaboratorRow
            key={collaborator.id}
            collaborator={collaborator}
            onRemove={() => removeCollaborator(portfolioId, collaborator.userId)}
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
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
