import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Screen } from "@/components/ui";
import { MusicPicker } from "@/components/review/MusicPicker";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useHungryTheme } from "@/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MusicSelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { palette, spacing } = useHungryTheme();
  const draft = useReviewDraftStore((state) => state.draft);
  const setMusicId = useReviewDraftStore((state) => state.setMusicId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={palette.text} size={28} />
        </Pressable>
        <AppText variant="h2">Select Music</AppText>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[4] }}>
        <MusicPicker
          selectedMusicId={draft.musicId}
          onSelectMusic={(id) => {
            setMusicId(id);
            if (id) {
              navigation.goBack();
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
});
