import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { CollaboratorRow } from "@/components/portfolio";
import { AppText, Card } from "@/components/ui";
import { runListMutation } from "@/features/checklistPortfolio/runListMutation";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCollaborators">;

export function PortfolioCollaboratorsScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const { collaborators, loadPortfolioCollaborators, removeCollaborator } = usePortfolioStore();
  const portfolioCollaborators = collaborators[portfolioId] ?? [];

  useEffect(() => {
    void loadPortfolioCollaborators(portfolioId);
  }, [loadPortfolioCollaborators, portfolioId]);

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
            People who can view or edit this portfolio.
          </AppText>
        </View>
      </View>

      {/* Adding people needs a user/follower picker or invite link (product decision);
          a raw user id field was unusable because ids are shown nowhere in the app. */}
      <Card>
        <AppText variant="h3">{"Inviting collaborators isn't available yet"}</AppText>
        <AppText variant="body" tone="secondary">
          You can still remove people who already collaborate on this list.
        </AppText>
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
            onRemove={() =>
              void runListMutation(() => removeCollaborator(portfolioId, collaborator.userId), {
                success: "Collaborator removed",
                failure: "Couldn't remove the collaborator.",
              })
            }
          />
        ))
      )}
    </ScrollView>
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
