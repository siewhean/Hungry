import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioTypeSelector, PortfolioVisibilitySelector } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioType, PortfolioVisibility } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCreate">;

export function PortfolioCreateScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useHungryTheme();
  const createPortfolio = usePortfolioStore((state) => state.createPortfolio);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PortfolioType>("recommendation");
  const [visibility, setVisibility] = useState<PortfolioVisibility>("private");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = name.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const portfolio = await createPortfolio({
        name,
        description: description.trim() || undefined,
        type,
        visibility,
      });
      navigation.replace("PortfolioDetail", { portfolioId: portfolio.id });
    } catch (error) {
      Alert.alert(
        "Could not complete action",
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
          <AppText variant="h1">Create portfolio</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Start with a private list and publish when it is ready.
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="Title"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Best laksa nearby"
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What makes this list useful?"
          multiline
        />
      </Card>

      <Card>
        <AppText variant="bodyBold">Type</AppText>
        <PortfolioTypeSelector value={type} onChange={setType} />
      </Card>

      <Card>
        <AppText variant="bodyBold">Visibility</AppText>
        <PortfolioVisibilitySelector value={visibility} onChange={setVisibility} />
      </Card>

      <Button label="Create portfolio" loading={isSaving} disabled={!canSave} onPress={save} />
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
