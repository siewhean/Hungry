import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Search } from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { CollaboratorRow, collaboratorName } from "@/components/portfolio";
import { AppText, Avatar, Button, Card, Chip, Input } from "@/components/ui";
import { runListMutation } from "@/features/checklistPortfolio/runListMutation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioCollaborator, PortfolioCollaboratorRole } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCollaborators">;

type FollowedPerson = { userId: string; displayName: string; avatarUrl?: string };

/** The list RPC's page maximum; the picker shows people the owner follows. */
const FOLLOWING_PICKER_LIMIT = 500;

export function PortfolioCollaboratorsScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const portfolioId = route.params.portfolioId;
  const profileId = useProfileStore((state) => state.profile.id);
  const {
    collaborators,
    loadPortfolioCollaborators,
    addCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
  } = usePortfolioStore(
    useShallow((state) => ({
      collaborators: state.collaborators,
      loadPortfolioCollaborators: state.loadPortfolioCollaborators,
      addCollaborator: state.addCollaborator,
      updateCollaboratorRole: state.updateCollaboratorRole,
      removeCollaborator: state.removeCollaborator,
    })),
  );
  const portfolioCollaborators = collaborators[portfolioId] ?? [];

  const [collaboratorsState, setCollaboratorsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [following, setFollowing] = useState<FollowedPerson[]>([]);
  const [followingState, setFollowingState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<PortfolioCollaboratorRole>("viewer");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const loadCollaborators = useCallback(async () => {
    setCollaboratorsState("loading");
    try {
      await loadPortfolioCollaborators(portfolioId);
      setCollaboratorsState("ready");
    } catch {
      setCollaboratorsState("error");
    }
  }, [loadPortfolioCollaborators, portfolioId]);

  useEffect(() => {
    void loadCollaborators();
  }, [loadCollaborators]);

  const loadFollowing = useCallback(async () => {
    setFollowingState("loading");
    try {
      const rows = await getHungryService().social.listFollowing(profileId, {
        limit: FOLLOWING_PICKER_LIMIT,
      });
      setFollowing(rows.filter((row) => row.userId && row.userId !== profileId));
      setFollowingState("ready");
    } catch {
      setFollowingState("error");
    }
  }, [profileId]);

  useEffect(() => {
    void loadFollowing();
  }, [loadFollowing]);

  const collaboratorIds = useMemo(
    () => new Set(portfolioCollaborators.map((collaborator) => collaborator.userId)),
    [portfolioCollaborators],
  );
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return following.filter(
      (person) => !needle || person.displayName.toLowerCase().includes(needle),
    );
  }, [following, query]);

  const handleAdd = async (person: FollowedPerson) => {
    if (addingUserId) return;
    setAddingUserId(person.userId);
    const name = collaboratorName(person);
    await runListMutation(() => addCollaborator(portfolioId, person.userId, role), {
      success: `${name} can now ${role === "editor" ? "edit" : "view"} this list`,
      failure: "Couldn't add the collaborator.",
    });
    setAddingUserId(null);
  };

  const confirmRemove = (collaborator: PortfolioCollaborator) => {
    const name = collaboratorName(collaborator);
    Alert.alert(`Remove ${name}?`, "They will no longer see or edit this list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          void runListMutation(() => removeCollaborator(portfolioId, collaborator.userId), {
            success: "Collaborator removed",
            failure: "Couldn't remove the collaborator.",
          }),
      },
    ]);
  };

  const header = (
    <View style={{ gap: spacing[4] }}>
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
            People who can view or edit this list.
          </AppText>
        </View>
      </View>

      {collaboratorsState === "loading" ? (
        <ActivityIndicator color={palette.orange} />
      ) : collaboratorsState === "error" ? (
        <Card style={{ gap: spacing[2] }}>
          <AppText variant="body" tone="secondary">
            {"Couldn't load this list's collaborators."}
          </AppText>
          <Button
            label="Retry"
            variant="secondary"
            size="sm"
            onPress={() => void loadCollaborators()}
          />
        </Card>
      ) : portfolioCollaborators.length === 0 ? (
        <Card>
          <AppText variant="h3">No collaborators yet</AppText>
          <AppText variant="body" tone="secondary">
            Add people you follow below.
          </AppText>
        </Card>
      ) : (
        portfolioCollaborators.map((collaborator) => (
          <CollaboratorRow
            key={collaborator.id}
            collaborator={collaborator}
            onChangeRole={(nextRole) =>
              void runListMutation(
                () => updateCollaboratorRole(portfolioId, collaborator.userId, nextRole),
                {
                  success: `${collaboratorName(collaborator)} can now ${
                    nextRole === "editor" ? "edit" : "view"
                  } this list`,
                  failure: "Couldn't change the role.",
                },
              )
            }
            onRemove={() => confirmRemove(collaborator)}
          />
        ))
      )}

      {collaboratorsState === "ready" ? (
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">Add people you follow</AppText>
          <View style={styles.roleRow}>
            <AppText variant="bodySmall" tone="secondary">
              Add as
            </AppText>
            <Chip
              label="Viewer"
              accessibilityLabel="Add people as viewers"
              selected={role === "viewer"}
              onPress={() => setRole("viewer")}
            />
            <Chip
              label="Editor"
              accessibilityLabel="Add people as editors"
              selected={role === "editor"}
              onPress={() => setRole("editor")}
            />
          </View>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search people you follow"
            leftIcon={<Search size={18} color={palette.textMuted} />}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {followingState === "loading" ? (
            <ActivityIndicator color={palette.orange} />
          ) : followingState === "error" ? (
            <Card style={{ gap: spacing[2] }}>
              <AppText variant="body" tone="secondary">
                {"Couldn't load the people you follow."}
              </AppText>
              <Button
                label="Retry"
                variant="secondary"
                size="sm"
                onPress={() => void loadFollowing()}
              />
            </Card>
          ) : matches.length === 0 ? (
            <Card>
              <AppText variant="body" tone="secondary">
                {following.length === 0
                  ? "Follow people to add them as collaborators."
                  : "No one you follow matches that name."}
              </AppText>
            </Card>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    // One virtualized list: up to 500 followed people must not all render at once.
    <FlatList
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: Math.max(insets.top, spacing[4]) }}
      contentContainerStyle={[styles.content, { gap: spacing[3], padding: spacing[4] }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      data={collaboratorsState === "ready" && followingState === "ready" ? matches : []}
      keyExtractor={(person) => person.userId}
      renderItem={({ item: person }) => {
        const name = collaboratorName(person);
        const isAdded = collaboratorIds.has(person.userId);
        return (
          <Card>
            <View style={styles.personRow}>
              <Avatar name={name} uri={person.avatarUrl} size={40} />
              <AppText variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                {name}
              </AppText>
              {isAdded ? (
                <AppText variant="bodySmall" tone="secondary">
                  Added
                </AppText>
              ) : (
                <Button
                  label="Add"
                  accessibilityLabel={`Add ${name} as ${role}`}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={addingUserId === person.userId}
                  disabled={addingUserId !== null}
                  onPress={() => void handleAdd(person)}
                />
              )}
            </View>
          </Card>
        );
      }}
    />
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
  personRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  roleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
