import React, { useEffect, useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChecklistCard } from "@/components/checklist";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useSessionStore } from "@/store/useSessionStore";
import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "ChecklistsHome">;

export function ChecklistsHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useHungryTheme();
  const { checklists, items, isLoaded, loadChecklists, createChecklist } = useChecklistStore();
  const { isAuthenticated } = useSessionStore();
  const [isCreating, setIsCreating] = useState(false);
  const insets = useSafeAreaInsets();
  const topSpacing = Math.max(insets.top, theme.spacing[4]);

  useEffect(() => {
    if (isAuthenticated && !isLoaded) {
      loadChecklists();
    }
  }, [isAuthenticated, isLoaded, loadChecklists]);

  const handleCreateChecklist = async () => {
    setIsCreating(true);
    try {
      const checklist = await createChecklist("New Checklist");
      navigation.navigate("ChecklistDetail", { checklistId: checklist.id });
    } catch (error) {
      console.error("Failed to create checklist:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.palette.bg, paddingTop: topSpacing }]}
      >
        <AppText variant="body" style={styles.emptyText}>
          Sign in to create checklists
        </AppText>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.palette.bg, paddingTop: topSpacing }]}
      >
        <AppText variant="body" style={styles.emptyText}>
          Loading...
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.palette.bg, paddingTop: topSpacing }]}>
      <View style={styles.header}>
        <AppText variant="h2">My Checklists</AppText>
        <Button
          label="Create"
          onPress={handleCreateChecklist}
          disabled={isCreating}
          variant="primary"
        />
      </View>

      {checklists.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText variant="h3" style={styles.emptyTitle}>
            No checklists yet
          </AppText>
          <AppText variant="body" style={styles.emptyText}>
            Create your first checklist to track dishes and stalls you want to try
          </AppText>
          <Button
            label="Create Checklist"
            onPress={handleCreateChecklist}
            disabled={isCreating}
            variant="primary"
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          data={checklists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChecklistCard
              checklist={item}
              itemCount={items[item.id]?.length ?? 0}
              triedCount={(items[item.id] ?? []).filter((entry) => Boolean(entry.triedAt)).length}
              onPress={() => navigation.navigate("ChecklistDetail", { checklistId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    minWidth: 200,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
});
