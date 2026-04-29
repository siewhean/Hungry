import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Users, Search, X, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { BottomSheetModal, BottomSheetFlatList } from "@gorhom/bottom-sheet";

import { AppText, Input, IconButton, BottomSheet, Button, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";

const MOCK_USERS = [
  { id: "u1", name: "Alex eats", handle: "@alex_eats", avatar: "https://i.pravatar.cc/150?u=u1" },
  { id: "u2", name: "Sarah Foodie", handle: "@foodie_sarah", avatar: "https://i.pravatar.cc/150?u=u2" },
  { id: "u3", name: "Hawker King", handle: "@sg_hawker_king", avatar: "https://i.pravatar.cc/150?u=u3" },
  { id: "u4", name: "Michelin Seeker", handle: "@michelin_seeker", avatar: "https://i.pravatar.cc/150?u=u4" },
  { id: "u5", name: "Hungry Nomad", handle: "@hungry_nomad", avatar: "https://i.pravatar.cc/150?u=u5" },
  { id: "u6", name: "Chef Lim", handle: "@chef_lim", avatar: "https://i.pravatar.cc/150?u=u6" },
  { id: "u7", name: "Taste of SG", handle: "@taste_sg", avatar: "https://i.pravatar.cc/150?u=u7" },
];

interface CollaboratorModalProps {
  innerRef: React.RefObject<BottomSheetModal | null>;
}

export function CollaboratorModal({ innerRef }: CollaboratorModalProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [searchQuery, setSearchQuery] = useState("");
  
  const collaborators = useComposerStore((state) => state.collaborators);
  const toggleCollaborator = useComposerStore((state) => state.toggleCollaborator);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return MOCK_USERS;
    const query = searchQuery.toLowerCase();
    return MOCK_USERS.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.handle.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleToggle = (handle: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleCollaborator(handle);
  };

  return (
    <BottomSheet ref={innerRef} snapPoints={["80%"]} keyboardBehavior="interactive">
      <View style={{ flex: 1, marginHorizontal: -16 }}>
        <View style={styles.header}>
          <AppText variant="h3">Tag Collaborators</AppText>
          <IconButton 
            icon={<X size={24} color={palette.text} />} 
            accessibilityLabel="Close"
            onPress={() => innerRef.current?.dismiss()} 
          />
        </View>

        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by name or @handle..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
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
                style={({ pressed }) => [
                  styles.userItem,
                  {
                    backgroundColor: isSelected ? palette.orangeLight : (pressed ? palette.surfaceRaised : "transparent"),
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Avatar uri={item.avatar} name={item.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyBold" style={{ color: isSelected ? palette.orange : palette.text }}>
                    {item.name}
                  </AppText>
                  <AppText variant="micro" tone="secondary">{item.handle}</AppText>
                </View>
                {isSelected && <Check size={20} color={palette.orange} />}
              </Pressable>
            );
          }}
          style={{ flex: 1, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        />

        <View style={[styles.footer, { paddingBottom: Platform.OS === "ios" ? 40 : 20, paddingHorizontal: 16 }]}>
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
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    marginVertical: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
});
