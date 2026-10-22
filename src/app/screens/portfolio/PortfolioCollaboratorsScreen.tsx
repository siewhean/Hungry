import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, UserPlus } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { CollaboratorRow } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaboratorRole } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCollaborators">;

export function PortfolioCollaboratorsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useHungryTheme();
  const portfolioId = route.params.portfolioId;
  const { collaborators, loadPortfolioCollaborators, addCollaborator, removeCollaborator } =
    usePortfolioStore();
  const portfolioCollaborators = collaborators[portfolioId] ?? [];
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<{ userId: string; displayName: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState<PortfolioCollaboratorRole>("viewer");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadPortfolioCollaborators(portfolioId).catch((error: unknown) =>
      Alert.alert(
        "Could not load collaborators",
        error instanceof Error ? error.message : "Please retry.",
      ),
    );
  }, [loadPortfolioCollaborators, portfolioId]);

  useEffect(() => {
    let active = true;
    setUserId("");
    setPeople([]);
    if (query.trim().length < 2) {
      setPeople([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void getHungryService()
        .social.searchUsers(query.trim())
        .then((results) => {
          if (active) setPeople(results);
        })
        .catch((error: unknown) => {
          if (active)
            Alert.alert("Search failed", error instanceof Error ? error.message : "Please retry.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function add() {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return;
    setIsSaving(true);
    try {
      await addCollaborator(portfolioId, normalizedUserId, role);
      setUserId("");
    } catch (error) {
      Alert.alert(
        "Could not add collaborator",
        error instanceof Error ? error.message : "Please retry.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
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
          label="Find a person"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name"
        />
        {searching ? <AppText variant="bodySmall">Searching…</AppText> : null}
        {people.map((person) => (
          <Button
            key={person.userId}
            label={`${person.displayName}${userId === person.userId ? " · Selected" : ""}`}
            variant="secondary"
            onPress={() => setUserId(person.userId)}
          />
        ))}
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
            onRemove={() => {
              void removeCollaborator(portfolioId, collaborator.userId).catch((error: unknown) =>
                Alert.alert(
                  "Could not remove collaborator",
                  error instanceof Error ? error.message : "Please retry.",
                ),
              );
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
