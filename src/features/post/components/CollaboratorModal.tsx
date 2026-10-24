import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Search, X, Check } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";
import { BottomSheetModal, BottomSheetFlatList } from "@gorhom/bottom-sheet";

import { AppText, Input, IconButton, BottomSheet, Button, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { listComposerCollaboratorOptions } from "@/features/post/composerOptions";

interface CollaboratorModalProps {
  innerRef: React.RefObject<BottomSheetModal | null>;
}

export function CollaboratorModal({ innerRef }: CollaboratorModalProps) {
  const { componentRadii, palette, radii, semanticSpacing, spacing } = useHungryTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const users = useMemo(() => listComposerCollaboratorOptions(), []);

  const collaborators = useComposerStore((state) => state.collaborators);
  const toggleCollaborator = useComposerStore((state) => state.toggleCollaborator);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) || user.handle.toLowerCase().includes(query),
    );
  }, [searchQuery, users]);

  const handleToggle = (handle: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleCollaborator(handle);
  };

  return (
    <BottomSheet
      ref={innerRef}
      snapPoints={["80%"]}
      keyboardBehavior="interactive"
      accessibilityLabel="Tag collaborators"
    >
      <View style={{ flex: 1, marginHorizontal: -semanticSpacing.screenEdge }}>
        <View
          style={[
            styles.header,
            { marginBottom: spacing[2], paddingHorizontal: semanticSpacing.screenEdge },
          ]}
        >
          <AppText variant="h3">Tag collaborators</AppText>
          <IconButton
            icon={<X size={24} color={palette.text} />}
            accessibilityLabel="Close"
            onPress={() => innerRef.current?.dismiss()}
          />
        </View>

        <View
          style={[
            styles.searchContainer,
            { marginBottom: spacing[2], paddingHorizontal: semanticSpacing.screenEdge },
          ]}
        >
          <Input
            placeholder="Search by name or @handle..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear collaborator search"
                  accessibilityHint="Clears the current collaborator search text"
                  style={{ padding: spacing[1] }}
                >
                  <X size={16} color={palette.textMuted} />
                </Pressable>
              ) : undefined
            }
          />
        </View>

        <BottomSheetFlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = collaborators.includes(item.handle);
            return (
              <Pressable
                onPress={() => handleToggle(item.handle)}
                accessibilityRole="button"
                accessibilityLabel={`${isSelected ? "Remove" : "Add"} collaborator ${item.name}, ${item.handle}`}
                accessibilityHint="Toggles this collaborator on the post"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.userItem,
                  {
                    backgroundColor: isSelected
                      ? palette.orangeLight
                      : pressed
                        ? palette.surfaceRaised
                        : "transparent",
                    borderRadius: componentRadii.card,
                    gap: spacing[3],
                    marginVertical: spacing[0.5],
                    padding: spacing[3],
                  },
                ]}
              >
                <Avatar uri={item.avatar} name={item.name} size={40} />
                <View style={{ flex: 1, gap: spacing[0.5] }}>
                  <AppText
                    variant="bodyBold"
                    style={{ color: isSelected ? palette.orange : palette.text }}
                  >
                    {item.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary">
                    {item.handle}
                  </AppText>
                </View>
                {isSelected && <Check size={20} color={palette.orange} />}
              </Pressable>
            );
          }}
          style={{ flex: 1, paddingHorizontal: semanticSpacing.screenEdge }}
          contentContainerStyle={{ paddingBottom: spacing[20] + spacing[5] }}
        />

        <View
          style={[
            styles.footer,
            {
              borderTopColor: palette.border,
              padding: spacing[4],
              paddingBottom: Platform.OS === "ios" ? spacing[8] + spacing[2] : spacing[5],
              paddingHorizontal: semanticSpacing.screenEdge,
            },
          ]}
        >
          <Button
            label={`Done (${collaborators.length} tagged)`}
            variant="primary"
            onPress={() => innerRef.current?.dismiss()}
            fullWidth
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {},
  userItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    borderTopWidth: 1,
  },
});
